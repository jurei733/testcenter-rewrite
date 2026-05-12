import { Injectable, inject } from "@angular/core";

import { RewriteAppShellService } from "./rewrite-app-shell.service";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

@Injectable({ providedIn: "root" })
export class WorkspaceViewFacade {
  private readonly shell = inject(RewriteAppShellService);
  private readonly uiState = inject(RewriteAppUiStateService);

  readonly workspace = this.uiState.workspace;

  get workspaceActivityView(): string {
    return this.uiState.workspace.workspaceActivityView;
  }

  init(): void {
    this.shell.setActiveView("workspace");
  }

  persistState(): void {
    this.shell.persistShellState();
  }

  onAutoRefreshSettingsChanged(): void {
    this.shell.onAutoRefreshSettingsChanged();
  }

  createTenant(): void {
    this.shell.onActionAsync(() => this.shell.createTenant());
  }

  createWorkspace(): void {
    this.shell.onActionAsync(() => this.shell.createWorkspace());
  }

  refreshWorkspaceOverview(): void {
    this.shell.onActionAsync(() => this.shell.refreshWorkspaceOverview());
  }
}
