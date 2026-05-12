import { Injectable, inject } from "@angular/core";

import { RewriteAppShellService } from "./rewrite-app-shell.service";
import type { AppView } from "./rewrite-app-shell.types";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

@Injectable({ providedIn: "root" })
export class AppShellFacade {
  private readonly shell = inject(RewriteAppShellService);
  private readonly uiState = inject(RewriteAppUiStateService);

  readonly renderVersion = this.uiState.renderVersion;
  readonly responseMeta = this.uiState.responseMeta;
  readonly lastResponse = this.uiState.lastResponse;
  readonly activeRequestLabel = this.uiState.activeRequestLabel;
  readonly errorMessage = this.uiState.errorMessage;
  readonly feedback = this.uiState.feedback;
  readonly ops = this.uiState.ops;

  readonly views = [
    { id: "workspace", label: "Workspace", link: "/workspace" },
    { id: "content", label: "Content", link: "/content" },
    { id: "runtime", label: "Runtime", link: "/runtime" },
    { id: "ops", label: "Diagnostics", link: "/ops" }
  ] as const;

  get activeView(): AppView {
    return this.uiState.activeView;
  }

  init(): void {
    this.shell.init();
  }

  destroy(): void {
    this.shell.destroy();
  }

  getPersistedView(): AppView {
    return this.shell.getPersistedView();
  }
}
