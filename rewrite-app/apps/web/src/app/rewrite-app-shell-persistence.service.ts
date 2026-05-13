import { Injectable, inject } from "@angular/core";

import { createShellPersistenceStateHost } from "./rewrite-app-shell.state-hosts";
import {
  applyHydratedShellState,
  createPersistedShellState
} from "./rewrite-app-shell.storage";
import {
  type PersistedShellState,
  SHELL_STORAGE_KEY
} from "./rewrite-app-shell.types";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

@Injectable({ providedIn: "root" })
export class RewriteAppShellPersistenceService {
  private readonly uiState = inject(RewriteAppUiStateService);

  private readonly workspaceState = this.uiState.workspace;
  private readonly contentState = this.uiState.content;
  private readonly runtimeState = this.uiState.runtime;
  private readonly opsState = this.uiState.ops;

  persistShellState(): void {
    window.localStorage.setItem(
      SHELL_STORAGE_KEY,
      JSON.stringify(createPersistedShellState(this.createPersistenceStateHost()))
    );
  }

  hydrateShellState(): void {
    const rawValue = window.localStorage.getItem(SHELL_STORAGE_KEY);
    if (!rawValue) {
      return;
    }

    try {
      applyHydratedShellState(
        this.createPersistenceStateHost(),
        JSON.parse(rawValue) as Partial<PersistedShellState>
      );
    } catch {
      // Ignore broken browser state and keep defaults.
    }
  }

  private createPersistenceStateHost() {
    return createShellPersistenceStateHost({
      workspaceState: this.workspaceState,
      contentState: this.contentState,
      runtimeState: this.runtimeState,
      opsState: this.opsState,
      getActiveView: () => this.uiState.activeView,
      setActiveView: nextValue => {
        this.uiState.activeView = nextValue;
      },
      getShowRawDebug: () => this.uiState.showRawDebug,
      setShowRawDebug: nextValue => {
        this.uiState.showRawDebug = nextValue;
      }
    });
  }
}
