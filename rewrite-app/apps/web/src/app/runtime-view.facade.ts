import { Injectable, inject } from "@angular/core";

import { RewriteAppShellService } from "./rewrite-app-shell.service";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

@Injectable({ providedIn: "root" })
export class RuntimeViewFacade {
  private readonly shell = inject(RewriteAppShellService);
  private readonly uiState = inject(RewriteAppUiStateService);

  readonly runtime = this.uiState.runtime;

  get participantSessionsView(): string {
    return this.uiState.runtime.participantSessionsView;
  }

  init(): void {
    this.shell.setActiveView("runtime");
  }

  persistState(): void {
    this.shell.persistShellState();
  }

  participantSignIn(): void {
    this.shell.onActionAsync(() => this.shell.participantSignIn());
  }

  resumeSession(): void {
    this.shell.onActionAsync(() => this.shell.resumeParticipantSession());
  }

  refreshRuntimeReads(): void {
    this.shell.onActionAsync(() => this.shell.refreshRuntimeReads());
  }

  saveProgressPaused(): void {
    this.shell.onActionAsync(() => this.shell.saveProgress("paused"));
  }

  saveProgressRunning(): void {
    this.shell.onActionAsync(() => this.shell.saveProgress("running"));
  }

  resumeRun(): void {
    this.shell.onActionAsync(() => this.shell.resumeRun());
  }

  completeRun(): void {
    this.shell.onActionAsync(() => this.shell.completeRun());
  }

  openRuns(): void {
    this.shell.onActionAsync(() => this.shell.refreshRuntimeReads());
  }

  participantHappyPathFlow(): void {
    this.shell.onActionAsync(() => this.shell.participantHappyPathFlow());
  }

  getParticipantSessionDetail(): void {
    this.shell.onActionAsync(() => this.shell.loadParticipantSessionDetail());
  }
}
