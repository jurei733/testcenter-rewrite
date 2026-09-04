import { Injectable, inject } from "@angular/core";

import {
  clearShellAutoRefresh,
  ensureShellDataForView,
  scheduleShellAutoRefresh
} from "./rewrite-app-shell.lifecycle";
import { createShellLifecycleStateHost } from "./rewrite-app-shell.state-hosts";
import type { AppView } from "./rewrite-app-shell.types";
import { RewriteAppShellPersistenceService } from "./rewrite-app-shell-persistence.service";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

@Injectable({ providedIn: "root" })
export class RewriteAppShellLifecycleService {
  private readonly persistence = inject(RewriteAppShellPersistenceService);
  private readonly uiState = inject(RewriteAppUiStateService);

  private readonly workspaceState = this.uiState.workspace;
  private readonly contentState = this.uiState.content;
  private readonly runtimeState = this.uiState.runtime;
  private readonly opsState = this.uiState.ops;

  scheduleAutoRefresh(
    refreshWorkspaceOverview: (quiet?: boolean) => Promise<void>,
    refreshContentReads: (quiet?: boolean) => Promise<void>,
    refreshRuntimeReads: (quiet?: boolean) => Promise<void>,
    refreshOperationalDiagnostics: (quiet?: boolean) => Promise<void>
  ): void {
    scheduleShellAutoRefresh(
      this.createLifecycleHost(
        refreshWorkspaceOverview,
        refreshContentReads,
        refreshRuntimeReads,
        refreshOperationalDiagnostics
      )
    );
  }

  clearAutoRefresh(
    refreshWorkspaceOverview: (quiet?: boolean) => Promise<void>,
    refreshContentReads: (quiet?: boolean) => Promise<void>,
    refreshRuntimeReads: (quiet?: boolean) => Promise<void>,
    refreshOperationalDiagnostics: (quiet?: boolean) => Promise<void>
  ): void {
    clearShellAutoRefresh(
      this.createLifecycleHost(
        refreshWorkspaceOverview,
        refreshContentReads,
        refreshRuntimeReads,
        refreshOperationalDiagnostics
      )
    );
  }

  ensureDataForView(
    view: AppView,
    refreshWorkspaceOverview: (quiet?: boolean) => Promise<void>,
    refreshContentReads: (quiet?: boolean) => Promise<void>,
    refreshRuntimeReads: (quiet?: boolean) => Promise<void>,
    refreshOperationalDiagnostics: (quiet?: boolean) => Promise<void>
  ): Promise<void> {
    return ensureShellDataForView(
      this.createLifecycleHost(
        refreshWorkspaceOverview,
        refreshContentReads,
        refreshRuntimeReads,
        refreshOperationalDiagnostics
      ),
      view
    );
  }

  persistShellState(): void {
    this.persistence.persistShellState();
  }

  hydrateShellState(): void {
    this.persistence.hydrateShellState();
  }

  private createLifecycleHost(
    refreshWorkspaceOverview: (quiet?: boolean) => Promise<void>,
    refreshContentReads: (quiet?: boolean) => Promise<void>,
    refreshRuntimeReads: (quiet?: boolean) => Promise<void>,
    refreshOperationalDiagnostics: (quiet?: boolean) => Promise<void>
  ) {
    return createShellLifecycleStateHost({
      workspaceState: this.workspaceState,
      contentState: this.contentState,
      runtimeState: this.runtimeState,
      opsState: this.opsState,
      getActiveView: () => this.uiState.activeView,
      setActiveView: nextValue => {
        this.uiState.activeView = nextValue;
      },
      getAutoRefreshHandle: () => this.uiState.autoRefreshHandle,
      setAutoRefreshHandle: nextValue => {
        this.uiState.autoRefreshHandle = nextValue;
      },
      refreshWorkspaceOverview,
      refreshContentReads,
      refreshRuntimeReads,
      refreshOperationalDiagnostics
    });
  }
}
