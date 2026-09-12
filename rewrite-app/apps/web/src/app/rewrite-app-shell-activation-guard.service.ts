import { Injectable, inject } from "@angular/core";

import { type GetContentReleaseActivationReadinessResponse } from "@testcenter-rewrite-app/contracts";
import { applyActivationReadinessView } from "./rewrite-app-shell.activation";
import { RewriteAppShellFeedbackService } from "./rewrite-app-shell-feedback.service";
import { createActivationGuardStateHost } from "./rewrite-app-shell.hosts";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

@Injectable({ providedIn: "root" })
export class RewriteAppShellActivationGuardService {
  private readonly feedback = inject(RewriteAppShellFeedbackService);
  private readonly uiState = inject(RewriteAppUiStateService);

  private readonly contentState = this.uiState.content;
  private readonly runtimeState = this.uiState.runtime;

  createStateActivationGuardHost() {
    return createActivationGuardStateHost({
      contentState: this.contentState,
      runtimeState: this.runtimeState,
      updateMonitorSummary: (headline, detail) => {
        this.feedback.updateMonitorSummary(headline, detail);
      },
      rememberActivity: (title, detail) => this.feedback.rememberActivity(title, detail)
    });
  }

  applyActivationReadiness(
    payload: GetContentReleaseActivationReadinessResponse
  ): void {
    applyActivationReadinessView(this.createStateActivationGuardHost(), payload);
  }
}
