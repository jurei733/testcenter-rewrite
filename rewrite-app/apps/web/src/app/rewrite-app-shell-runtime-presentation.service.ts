import { Injectable, inject } from "@angular/core";

import { createRuntimePresentationStateHost } from "./rewrite-app-shell.hosts";
import { RewriteAppShellFeedbackService } from "./rewrite-app-shell-feedback.service";
import { RewriteAppShellPersistenceService } from "./rewrite-app-shell-persistence.service";
import { RewriteAppShellRequestService } from "./rewrite-app-shell-request.service";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

@Injectable({ providedIn: "root" })
export class RewriteAppShellRuntimePresentationService {
  private readonly feedback = inject(RewriteAppShellFeedbackService);
  private readonly persistence = inject(RewriteAppShellPersistenceService);
  private readonly requestState = inject(RewriteAppShellRequestService);
  private readonly uiState = inject(RewriteAppUiStateService);

  private readonly workspaceState = this.uiState.workspace;
  private readonly runtimeState = this.uiState.runtime;

  createRuntimePresentationHost() {
    return createRuntimePresentationStateHost({
      request: <T>(
        label: string,
        method: string,
        path: string,
        body?: unknown,
        options: { quiet?: boolean } = {}
      ) => this.requestState.request<T>(label, method, path, body, options),
      workspaceState: this.workspaceState,
      runtimeState: this.runtimeState,
      persistShellState: () => this.persistence.persistShellState(),
      updateRuntimeSummary: (headline, detail) => {
        this.feedback.updateRuntimeSummary(headline, detail);
      },
      updateMonitorSummary: (headline, detail) => {
        this.feedback.updateMonitorSummary(headline, detail);
      },
      rememberActivity: (title, detail) => this.feedback.rememberActivity(title, detail)
    });
  }
}
