import { Injectable, inject } from "@angular/core";

import { RewriteAppShellFeedbackService } from "./rewrite-app-shell-feedback.service";
import { createShellOpsStateHost } from "./rewrite-app-shell.hosts";
import { RewriteAppShellRequestService } from "./rewrite-app-shell-request.service";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

@Injectable({ providedIn: "root" })
export class RewriteAppShellOpsHostsService {
  private readonly feedback = inject(RewriteAppShellFeedbackService);
  private readonly requestState = inject(RewriteAppShellRequestService);
  private readonly uiState = inject(RewriteAppUiStateService);

  private readonly opsState = this.uiState.ops;

  createShellOpsHost() {
    return createShellOpsStateHost({
      requestJson: <T = Record<string, unknown>>(
        label: string,
        path: string,
        quiet = false
      ) => this.requestState.requestJson<T>(label, path, quiet),
      opsState: this.opsState,
      rememberActivity: (title, detail) => this.feedback.rememberActivity(title, detail)
    });
  }
}
