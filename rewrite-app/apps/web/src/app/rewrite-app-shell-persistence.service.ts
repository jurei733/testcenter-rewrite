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

const MAX_PERSISTED_SOURCE_DOCUMENT_CHARS = 200_000;

@Injectable({ providedIn: "root" })
export class RewriteAppShellPersistenceService {
  private readonly uiState = inject(RewriteAppUiStateService);

  private readonly workspaceState = this.uiState.workspace;
  private readonly contentState = this.uiState.content;
  private readonly runtimeState = this.uiState.runtime;
  private readonly opsState = this.uiState.ops;

  persistShellState(): void {
    const snapshot = this.createStorageSafeSnapshot();
    try {
      window.localStorage.setItem(SHELL_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      window.localStorage.setItem(
        SHELL_STORAGE_KEY,
        JSON.stringify({ ...snapshot, sourceDocument: "" })
      );
    }
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

  private createStorageSafeSnapshot(): PersistedShellState {
    const snapshot = createPersistedShellState(this.createPersistenceStateHost());
    if (this.shouldOmitSourceDocumentFromStorage(snapshot)) {
      return { ...snapshot, sourceDocument: "" };
    }
    return snapshot;
  }

  private shouldOmitSourceDocumentFromStorage(
    snapshot: PersistedShellState
  ): boolean {
    const sourceDocument = snapshot.sourceDocument.trim();
    const mediaType = snapshot.sourceMediaType.toLowerCase();
    return (
      sourceDocument.length > MAX_PERSISTED_SOURCE_DOCUMENT_CHARS ||
      mediaType.includes("zip") ||
      /^data:[^,]*;base64,/i.test(sourceDocument)
    );
  }
}
