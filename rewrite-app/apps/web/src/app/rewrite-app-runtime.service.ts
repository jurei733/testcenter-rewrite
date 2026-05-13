import { Injectable, inject } from "@angular/core";

import { type GetParticipantSessionResponse } from "@testcenter-rewrite-app/contracts";
import {
  createParticipantHappyPathFlowHost
} from "./rewrite-app-shell.hosts";
import { RewriteAppShellFeedbackService } from "./rewrite-app-shell-feedback.service";
import { RewriteAppShellRuntimePresentationService } from "./rewrite-app-shell-runtime-presentation.service";
import { RewriteAppShellRuntimeHostsService } from "./rewrite-app-shell-runtime-hosts.service";
import { loadParticipantSessionDetailAction } from "./rewrite-app-shell.runtime";
import {
  completeRunAction,
  participantSignInAction,
  resumeParticipantSessionAction,
  resumeRunAction,
  saveProgressAction
} from "./rewrite-app-shell.runtime-actions";
import { refreshRuntimeReadsAction } from "./rewrite-app-shell.runtime-reads";
import { runParticipantHappyPathFlow } from "./rewrite-app-shell.workflows";
import { RewriteAppContentService } from "./rewrite-app-content.service";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";
import { RewriteAppWorkspaceService } from "./rewrite-app-workspace.service";

@Injectable({ providedIn: "root" })
export class RewriteAppRuntimeService {
  private readonly feedback = inject(RewriteAppShellFeedbackService);
  private readonly hosts = inject(RewriteAppShellRuntimeHostsService);
  private readonly presentationHosts = inject(RewriteAppShellRuntimePresentationService);
  private readonly uiState = inject(RewriteAppUiStateService);
  private readonly workspaceService = inject(RewriteAppWorkspaceService);
  private readonly contentService = inject(RewriteAppContentService);

  private readonly runtimeState = this.uiState.runtime;

  async participantSignIn(): Promise<void> {
    await participantSignInAction(
      this.hosts.createRuntimeActionsHost(() =>
        this.refreshCrossViewStateAfterRuntimeChange()
      )
    );
  }

  async resumeParticipantSession(): Promise<void> {
    await resumeParticipantSessionAction(
      this.hosts.createRuntimeActionsHost(() =>
        this.refreshCrossViewStateAfterRuntimeChange()
      )
    );
  }

  async saveProgress(status: "paused" | "running"): Promise<void> {
    await saveProgressAction(
      this.hosts.createRuntimeActionsHost(() =>
        this.refreshCrossViewStateAfterRuntimeChange()
      ),
      status
    );
  }

  async resumeRun(): Promise<void> {
    await resumeRunAction(
      this.hosts.createRuntimeActionsHost(() =>
        this.refreshCrossViewStateAfterRuntimeChange()
      )
    );
  }

  async completeRun(): Promise<void> {
    await completeRunAction(
      this.hosts.createRuntimeActionsHost(() =>
        this.refreshCrossViewStateAfterRuntimeChange()
      )
    );
  }

  async refreshRuntimeReads(quiet = false): Promise<void> {
    await refreshRuntimeReadsAction(
      this.hosts.createRuntimeReadsHost(),
      this.getParticipantSessionId(),
      quiet
    );
  }

  async loadParticipantSessionDetail(): Promise<GetParticipantSessionResponse> {
    return loadParticipantSessionDetailAction(
      this.presentationHosts.createRuntimePresentationHost()
    );
  }

  async participantHappyPathFlow(): Promise<void> {
    await runParticipantHappyPathFlow(createParticipantHappyPathFlowHost({
      participantSignIn: () => this.participantSignIn(),
      resumeParticipantSession: () => this.resumeParticipantSession(),
      refreshRuntimeReads: () => this.refreshRuntimeReads(),
      rememberActivity: (title: string, detail: string) => {
        this.feedback.rememberActivity(title, detail);
      },
      getParticipantSessionId: () => this.getParticipantSessionId()
    }));
  }

  private async refreshCrossViewStateAfterRuntimeChange(): Promise<void> {
    await Promise.all([
      this.workspaceService.refreshWorkspaceOverview(true),
      this.contentService.refreshContentReads(true),
      this.refreshRuntimeReads(true)
    ]);
  }

  private getParticipantSessionId(): string {
    return this.runtimeState.participantSessionId.trim();
  }
}
