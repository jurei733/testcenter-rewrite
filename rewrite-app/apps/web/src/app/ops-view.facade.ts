import { Injectable, inject } from "@angular/core";

import { RewriteAppShellService } from "./rewrite-app-shell.service";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

@Injectable({ providedIn: "root" })
export class OpsViewFacade {
  private readonly shell = inject(RewriteAppShellService);
  private readonly uiState = inject(RewriteAppUiStateService);

  readonly ops = this.uiState.ops;

  init(): void {
    this.shell.setActiveView("ops");
  }

  refreshDiagnostics(): void {
    this.shell.onActionAsync(() => this.shell.refreshOperationalDiagnostics());
  }

  refreshMetrics(): void {
    this.shell.onActionAsync(() => this.shell.refreshMetricsOnly());
  }
}
