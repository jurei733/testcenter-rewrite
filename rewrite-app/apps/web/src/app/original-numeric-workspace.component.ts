import { Component, computed, effect, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { MatDialog } from "@angular/material/dialog";
import { ActivatedRoute } from "@angular/router";
import { redactBugReportText } from "@testcenter-rewrite-app/contracts";

import { AppShellFacade } from "./app-shell.facade";
import { NativeLoginErrorDialogComponent, type NativeErrorDialogData } from "./native-login-error-dialog.component";
import { AppError } from "./native-participant/app.interfaces";
import { OriginalWorkspaceFileSurfaceStylesComponent } from "./original-workspace-file-surface-styles.component";
import { OriginalWorkspaceFilesComponent } from "./original-workspace-files.component";
import type { OriginalNumericWorkspaceRoute } from "./original-workspace-browser-route";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

@Component({
  selector: "app-original-numeric-workspace",
  imports: [OriginalWorkspaceFilesComponent, OriginalWorkspaceFileSurfaceStylesComponent],
  template: `
    @if (workspace; as active) {
      <app-original-workspace-files
        [sessionToken]="state.ops.adminSessionToken"
        [tenantKey]="active.tenantKey" [workspaceKey]="active.workspaceKey"
        [workspaceNumber]="active.workspaceNumber" [nativeRole]="active.mode" />
    } @else {
      <app-original-workspace-file-surface-styles />
    }
  `,
  styles: [`
    :host { display: flex; flex: 1; flex-direction: column; min-height: 0; }
    app-original-workspace-file-surface-styles { display: none; }
  `]
})
export class OriginalNumericWorkspaceComponent {
  readonly state = inject(RewriteAppUiStateService);
  private readonly app = inject(AppShellFacade);
  private readonly dialogs = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly routeData = toSignal(this.route.data, { requireSync: true });
  private readonly resolution = computed(() => this.routeData()["originalWorkspace"] as OriginalNumericWorkspaceRoute);
  private readonly routeError = computed(() => {
    this.state.renderVersion();
    const result = this.resolution();
    return result.kind !== "workspace" && this.app.hasAdminSession && !this.app.requiresAdminPasswordChange
      ? result : null;
  });

  constructor() {
    effect(onCleanup => {
      const result = this.routeError();
      if (!result) return;

      const denied = result.kind === "denied";
      const workspaceNumber = this.route.snapshot.paramMap.get("workspaceNumber") ?? "";
      const details = /^[0-9]{1,19}$/.test(workspaceNumber)
        ? `workspaceAdmin ${workspaceNumber} nicht freigegeben.` : "";
      const error = denied
        ? new AppError({
            label: "Daten/Objekt nicht gefunden.",
            description: "Dieser Arbeitsbereich ist für Sie nicht freigegeben.",
            type: "backend",
            code: 404,
            details
          })
        : new AppError({
            label: "Der Arbeitsbereich konnte nicht geladen werden.",
            description: "",
            type: "network_temporally"
          });

      const url = new URL(window.location.href);
      url.search = "";
      url.hash = "";
      const token = this.state.ops.adminSessionToken;
      let active = true;
      const dialog = this.dialogs.open(NativeLoginErrorDialogComponent, {
        panelClass: "original-native-login-error-dialog",
        disableClose: true,
        autoFocus: "dialog",
        restoreFocus: false,
        ariaLabel: error.label,
        data: {
          error,
          url: redactBugReportText(url.href),
          login: this.app.operatorAccountDisplayName,
          timestamp: Date.now(),
          reload: () => {
            if (!active || token !== this.state.ops.adminSessionToken) return;
            if (denied) {
              window.location.assign(new URL("operator-start?ui=original", document.baseURI).href);
            } else {
              window.location.reload();
            }
          }
        } satisfies NativeErrorDialogData
      });
      onCleanup(() => {
        active = false;
        dialog.close();
      });
    });
  }

  get workspace() {
    this.state.renderVersion();
    const current = this.resolution();
    return current.kind === "workspace" && current.token === this.state.ops.adminSessionToken
      ? current.workspace : null;
  }
}
