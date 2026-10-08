import { Injectable, inject } from "@angular/core";

import {
  rememberShellActivityInState,
  updateShellSummaryCardInState
} from "./rewrite-app-shell.feedback";
import type { SummaryCard } from "./rewrite-app-shell.types";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

@Injectable({ providedIn: "root" })
export class RewriteAppShellFeedbackService {
  private readonly uiState = inject(RewriteAppUiStateService);
  private readonly feedbackState = this.uiState.feedback;

  rememberActivity(title: string, detail: string): void {
    rememberShellActivityInState(this.feedbackState, title, detail);
  }

  updateSummary(
    label: SummaryCard["label"],
    headline: string,
    detail: string
  ): void {
    updateShellSummaryCardInState(this.feedbackState, label, headline, detail);
  }

  updateWorkspaceSummary(headline: string, detail: string): void {
    this.updateSummary("Workspace", headline, detail);
  }

  updateContentSummary(headline: string, detail: string): void {
    this.updateSummary("Content", headline, detail);
  }

  updateRuntimeSummary(headline: string, detail: string): void {
    this.updateSummary("Runtime", headline, detail);
  }

  updateMonitorSummary(headline: string, detail: string): void {
    this.updateSummary("Monitor", headline, detail);
  }
}
