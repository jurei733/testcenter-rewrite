import { Injectable, inject } from "@angular/core";

import { RewriteAppShellFeedbackService } from "./rewrite-app-shell-feedback.service";
import { createWorkspaceActionsStateHost } from "./rewrite-app-shell.hosts";
import { RewriteAppShellRequestService } from "./rewrite-app-shell-request.service";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

@Injectable({ providedIn: "root" })
export class RewriteAppShellWorkspaceHostsService {
  private readonly feedback = inject(RewriteAppShellFeedbackService);
  private readonly requestState = inject(RewriteAppShellRequestService);
  private readonly uiState = inject(RewriteAppUiStateService);

  private readonly workspaceState = this.uiState.workspace;

  createWorkspaceActionsHost() {
    return createWorkspaceActionsStateHost({
      request: <T>(label: string, method: string, path: string, body?: unknown) =>
        this.requestState.request<T>(label, method, path, body),
      workspaceState: this.workspaceState,
      rememberActivity: (title, detail) => this.feedback.rememberActivity(title, detail)
    });
  }
}
