import { Location } from "@angular/common";
import { Component, inject } from "@angular/core";
import { MatTooltipModule } from "@angular/material/tooltip";
import { Router } from "@angular/router";
import { AppShellFacade } from "./app-shell.facade";
import { ApplicationSettingsService } from "./application-settings.service";
import { RewriteAppShellPersistenceService } from "./rewrite-app-shell-persistence.service";
import { ProofOfWorkService } from "./proof-of-work.service";
import { ParticipantShellStateService } from "./participant-shell-state.service";
import { OriginalOverlayStylesComponent } from "./original-overlay-styles.component";

// Original Header's native link/tooltip; primary activation remains guarded.
@Component({
  selector: "app-original-application-logo", standalone: true,
  imports: [MatTooltipModule, OriginalOverlayStylesComponent],
  template: `<app-original-overlay-styles /><div [class.standalone-logo]="standalone"><a [id]="standalone ? 'participantStandaloneLogo' : 'participantApplicationLogoButton'"
    [class.standalone]="standalone" [href]="href" aria-label="Gehe zur Startseite" (click)="activateLink($event)">
    <img id="applicationLogo" [src]="settings.assetUrl('logo', settings.settings().mainLogo)"
      alt="Logo der Anwendung" matTooltip="Zur Startseite" matTooltipClass="original-application-logo-tooltip" />
  </a></div>`,
  styles: [`:host { display: contents; }
    app-original-overlay-styles { display: none; }
    div { display: contents; }
    a { display: inline-flex; height: 48px; }
    a:not(.standalone) { font: 22px / 28px 'Nunito Sans'; }
    img { display: block; height: 100%; width: auto; }
    div.standalone-logo { display: block; position: absolute; top: 8px; right: 8px; z-index: 2; height: 48px; }
    a.standalone { display: inline; height: 100%; }
    a.standalone img { display: inline; }
    @media (max-width: 599px) { a:not(.standalone) { height: 40px; } }`]
})
export class OriginalApplicationLogoComponent {
  readonly settings = inject(ApplicationSettingsService);
  private readonly app = inject(AppShellFacade);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly persistence = inject(RewriteAppShellPersistenceService);
  private readonly protection = inject(ProofOfWorkService);
  private readonly participantShell = inject(ParticipantShellStateService);

  get standalone(): boolean { return this.currentPath === "/participant" && this.participantShell.headerHidden(); }

  private get currentPath(): string { return this.router.url.split("?", 1)[0]; }

  get href(): string {
    const queryParams: Record<string, string> = { ui: "original" };
    const destination = this.currentPath === "/system-check" ? "/home" : "/participant";
    if (destination === "/participant") {
      if (this.app.workspace.tenantKey.trim()) queryParams["tenantKey"] = this.app.workspace.tenantKey.trim();
      if (this.app.workspace.workspaceKey.trim()) queryParams["workspaceKey"] = this.app.workspace.workspaceKey.trim();
      if (this.currentPath === "/participant" && this.app.runtime.participantSessionId.trim()) {
        queryParams["participantSessionId"] = this.app.runtime.participantSessionId.trim();
        queryParams["view"] = "starter";
      }
    }
    return this.location.prepareExternalUrl(this.router.serializeUrl(this.router.createUrlTree([destination], { queryParams })));
  }

  activateLink(event: MouseEvent): void {
    if (event.button !== 0) return;
    const modified = event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
    // Source's non-login click handler cancels modified activation. Its real
    // href still supports copy-link and the browser's open-link menu.
    if (modified && this.currentPath === "/participant" && this.app.runtime.participantSessionId.trim()) {
      event.preventDefault();
      return;
    }
    if (modified && this.currentPath !== "/participant") {
      if (this.currentPath === "/ops") {
        const destination = this.href;
        setTimeout(() => window.location.assign(destination), 0);
      }
      return;
    }
    if (this.currentPath === "/system-check") {
      event.preventDefault();
      void this.router.navigateByUrl("/home");
    } else if (this.currentPath === "/participant") {
      if (this.app.runtime.participantSessionId.trim()) {
        event.preventDefault();
        globalThis.dispatchEvent(new CustomEvent("participant-leave-session"));
      } else {
        if (this.protection.busy() || this.app.activeRequestLabel() !== null) {
          event.preventDefault();
          return;
        }
        globalThis.dispatchEvent(new CustomEvent("participant-reset-entry", { detail: event }));
        if (!event.defaultPrevented) {
          this.app.runtime.loginKey = "";
          this.app.runtime.participantPassword = "";
          this.app.runtime.participantCode = "";
          this.persistence.persistShellState();
          if (modified) {
            // Source's login logout also reloads the originating tab after
            // native modified activation has opened its destination.
            const destination = this.href;
            setTimeout(() => window.location.assign(destination), 0);
          }
        }
      }
    }
  }
}
