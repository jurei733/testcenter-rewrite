import { Injectable, inject } from "@angular/core";

import { createWorkspaceContentPresentationStateHost } from "./rewrite-app-shell.hosts";
import { RewriteAppShellFeedbackService } from "./rewrite-app-shell-feedback.service";
import { RewriteAppShellPersistenceService } from "./rewrite-app-shell-persistence.service";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

@Injectable({ providedIn: "root" })
export class RewriteAppShellWorkspaceContentPresentationService {
  private readonly feedback = inject(RewriteAppShellFeedbackService);
  private readonly persistence = inject(RewriteAppShellPersistenceService);
  private readonly uiState = inject(RewriteAppUiStateService);

  private readonly workspaceState = this.uiState.workspace;
  private readonly contentState = this.uiState.content;
  private readonly runtimeState = this.uiState.runtime;

  createWorkspaceContentPresentationHost() {
    return createWorkspaceContentPresentationStateHost({
      workspaceState: this.workspaceState,
      contentState: this.contentState,
      runtimeState: this.runtimeState,
      persistShellState: () => this.persistence.persistShellState(),
      updateWorkspaceSummary: (headline, detail) => {
        this.feedback.updateWorkspaceSummary(headline, detail);
      },
      updateContentSummary: (headline, detail) => {
        this.feedback.updateContentSummary(headline, detail);
      },
      rememberActivity: (title, detail) => this.feedback.rememberActivity(title, detail)
    });
  }
}
