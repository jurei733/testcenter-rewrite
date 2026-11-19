import { Injectable, signal } from "@angular/core";

import type { ApiErrorLike } from "./rewrite-app-api.service";
import {
  DEFAULT_SOURCE_DOCUMENT,
  createInitialSummaryCards,
  type AppView
} from "./rewrite-app-shell.types";
import {
  createInitialShellContentState,
  createInitialShellFeedbackState,
  createInitialShellOpsState,
  createInitialShellRuntimeState,
  createInitialShellWorkspaceState
} from "./rewrite-app-shell.state";

@Injectable({ providedIn: "root" })
export class RewriteAppUiStateService {
  readonly renderVersion = signal(0);
  readonly adminSessionActive = signal(false);
  private readonly originalAccountRightsVisible = signal(false);
  readonly showOriginalAccountRights = this.originalAccountRightsVisible.asReadonly();
  readonly responseMeta = signal("Idle");
  readonly lastResponse = signal("No request sent yet.");
  readonly activeRequestLabel = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly lastApiError = signal<ApiErrorLike | null>(null);

  readonly feedback = createInitialShellFeedbackState(createInitialSummaryCards);
  readonly workspace = createInitialShellWorkspaceState();
  readonly content = createInitialShellContentState(DEFAULT_SOURCE_DOCUMENT);
  readonly ops = createInitialShellOpsState();
  readonly runtime = createInitialShellRuntimeState();

  activeView: AppView = "home";
  showRawDebug = false;
  autoRefreshHandle: number | null = null;
  autoRefreshInFlight = false;
  foregroundRequestDepth = 0;

  setAdminSessionToken(value: string): void {
    this.ops.adminSessionToken = value;
    const active = value.trim() !== "";
    this.adminSessionActive.set(active);
    if (!active) {
      this.originalAccountRightsVisible.set(false);
    }
  }

  publishOriginalAccountRights(): void {
    this.originalAccountRightsVisible.set(this.adminSessionActive());
  }

  syncAdminSessionToken(): void {
    this.adminSessionActive.set(this.ops.adminSessionToken.trim() !== "");
    this.originalAccountRightsVisible.set(false);
  }
}
