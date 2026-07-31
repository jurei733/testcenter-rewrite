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
  createReviewAction,
  deleteGroupResultsAction,
  deleteReviewAction,
  importParticipantRosterAction,
  issueMonitorRunCommandAction,
  participantLaunchAction,
  participantSignInAction,
  resumeParticipantSessionAction,
  resumeRunAction,
  saveProgressAction,
  updateReviewAction
} from "./rewrite-app-shell.runtime-actions";
import {
  exportOpenRunsCsvAction,
  exportParticipantSessionsCsvAction,
  exportParticipantRosterCsvAction,
  exportReviewsCsvAction,
  exportResponsesCsvAction,
  loadParticipantSessionsAction,
  loadParticipantRosterAction,
  loadDetailedResponsesAction,
  loadReviewsAction,
  refreshRuntimeReadsAction
} from "./rewrite-app-shell.runtime-reads";
import { runParticipantHappyPathFlow } from "./rewrite-app-shell.workflows";
import { RewriteAppContentService } from "./rewrite-app-content.service";
import { downloadTextFile } from "./download-text-file";
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

  async participantLaunch(): Promise<void> {
    await participantLaunchAction(
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

  async issueMonitorRunCommand(
    commandType:
      | "pause"
      | "resume"
      | "complete"
      | "goto"
      | "unlock_navigation"
  ): Promise<void> {
    await issueMonitorRunCommandAction(
      this.hosts.createRuntimeActionsHost(() =>
        this.refreshCrossViewStateAfterRuntimeChange()
      ),
      commandType
    );
    this.feedback.rememberActivity(
      commandType === "pause"
        ? "Monitor Pause Issued"
        : commandType === "resume"
          ? "Monitor Resume Issued"
          : commandType === "goto"
            ? "Monitor Go To Issued"
            : commandType === "unlock_navigation"
              ? "Monitor Navigation Unlocked"
            : "Monitor Complete Issued",
      `Monitor command '${commandType}' sent for ${this.runtimeState.testRunId || "the selected run"}.`
    );
  }

  async refreshRuntimeReads(quiet = false): Promise<void> {
    if (!this.hasWorkspaceScope()) {
      return;
    }
    await refreshRuntimeReadsAction(
      this.hosts.createRuntimeReadsHost(),
      this.getParticipantSessionId(),
      quiet
    );
  }

  async loadParticipantSessions(quiet = false): Promise<void> {
    if (!this.hasWorkspaceScope()) {
      return;
    }
    const payload = await loadParticipantSessionsAction(
      this.hosts.createRuntimeReadsHost(),
      quiet
    );
    if (!quiet) {
      this.feedback.rememberActivity(
        "Participant Sessions Loaded",
        `${payload.items.length} session(s) loaded with the current filters.`
      );
    }
  }

  async exportOpenRunsCsv(): Promise<string> {
    if (!this.hasWorkspaceScope()) {
      return "";
    }
    const csv = await exportOpenRunsCsvAction(this.hosts.createRuntimeReadsHost());
    const workspaceKey = this.uiState.workspace.workspaceKey.trim() || "workspace";
    downloadTextFile({
      filename: `${workspaceKey}-open-runs.csv`,
      mediaType: "text/csv;charset=utf-8",
      text: csv
    });
    this.feedback.rememberActivity(
      "Open Runs CSV Downloaded",
      `Open-run monitor export saved as ${workspaceKey}-open-runs.csv.`
    );
    return csv;
  }

  async exportParticipantSessionsCsv(): Promise<string> {
    if (!this.hasWorkspaceScope()) {
      return "";
    }
    const csv = await exportParticipantSessionsCsvAction(
      this.hosts.createRuntimeReadsHost()
    );
    const workspaceKey = this.uiState.workspace.workspaceKey.trim() || "workspace";
    downloadTextFile({
      filename: `${workspaceKey}-participant-sessions.csv`,
      mediaType: "text/csv;charset=utf-8",
      text: csv
    });
    this.feedback.rememberActivity(
      "Participant Sessions CSV Downloaded",
      `Participant sessions export saved as ${workspaceKey}-participant-sessions.csv.`
    );
    return csv;
  }

  async importParticipantRoster(): Promise<void> {
    if (!this.hasWorkspaceScope()) {
      return;
    }
    const payload = await importParticipantRosterAction(
      this.hosts.createRuntimeActionsHost(() =>
        this.refreshCrossViewStateAfterRuntimeChange()
      )
    );
    this.feedback.rememberActivity(
      "Participant Roster Imported",
      `${payload.importedCount} imported, ${payload.updatedCount} updated.`
    );
  }

  async loadParticipantRoster(quiet = false): Promise<void> {
    if (!this.hasWorkspaceScope()) {
      return;
    }
    const payload = await loadParticipantRosterAction(
      this.hosts.createRuntimeReadsHost(),
      quiet
    );
    if (!quiet) {
      this.feedback.rememberActivity(
        "Participant Roster Loaded",
        `${payload.items.length} saved roster entr${payload.items.length === 1 ? "y" : "ies"} loaded.`
      );
    }
  }

  async exportParticipantRosterCsv(): Promise<string> {
    if (!this.hasWorkspaceScope()) {
      return "";
    }
    const csv = await exportParticipantRosterCsvAction(
      this.hosts.createRuntimeReadsHost()
    );
    const workspaceKey = this.uiState.workspace.workspaceKey.trim() || "workspace";
    downloadTextFile({
      filename: `${workspaceKey}-participant-roster.csv`,
      mediaType: "text/csv;charset=utf-8",
      text: csv
    });
    this.feedback.rememberActivity(
      "Participant Roster CSV Downloaded",
      `Participant roster export saved as ${workspaceKey}-participant-roster.csv.`
    );
    return csv;
  }

  async loadParticipantSessionDetail(): Promise<GetParticipantSessionResponse> {
    if (!this.hasWorkspaceScope()) {
      throw new Error("Workspace scope is required before loading session detail.");
    }
    return loadParticipantSessionDetailAction(
      this.presentationHosts.createRuntimePresentationHost()
    );
  }

  async exportResponsesCsv(): Promise<string> {
    if (!this.hasWorkspaceScope()) {
      return "";
    }
    const csv = await exportResponsesCsvAction(this.hosts.createRuntimeReadsHost());
    const workspaceKey = this.uiState.workspace.workspaceKey.trim() || "workspace";
    downloadTextFile({
      filename: `${workspaceKey}-responses.csv`,
      mediaType: "text/csv;charset=utf-8",
      text: csv
    });
    this.feedback.rememberActivity(
      "Response CSV Downloaded",
      `Response export saved as ${workspaceKey}-responses.csv.`
    );
    return csv;
  }

  async exportReviewsCsv(): Promise<string> {
    if (!this.hasWorkspaceScope()) {
      return "";
    }
    const csv = await exportReviewsCsvAction(this.hosts.createRuntimeReadsHost());
    const workspaceKey = this.uiState.workspace.workspaceKey.trim() || "workspace";
    downloadTextFile({
      filename: `${workspaceKey}-reviews.csv`,
      mediaType: "text/csv;charset=utf-8",
      text: csv
    });
    this.feedback.rememberActivity(
      "Review CSV Downloaded",
      `Review export saved as ${workspaceKey}-reviews.csv.`
    );
    return csv;
  }

  async loadDetailedResponses(): Promise<void> {
    if (!this.hasWorkspaceScope()) {
      return;
    }
    const payload = await loadDetailedResponsesAction(this.hosts.createRuntimeReadsHost());
    this.feedback.rememberActivity(
      "Detailed Responses Loaded",
      `${payload.items.length} response row(s) loaded.`
    );
  }

  async loadReviews(): Promise<void> {
    if (!this.hasWorkspaceScope()) {
      return;
    }
    const payload = await loadReviewsAction(this.hosts.createRuntimeReadsHost());
    this.feedback.rememberActivity(
      "Reviews Loaded",
      `${payload.items.length} review(s) loaded.`
    );
  }

  async createReview(): Promise<void> {
    const payload = await createReviewAction(
      this.hosts.createRuntimeActionsHost(() =>
        this.refreshCrossViewStateAfterRuntimeChange()
      )
    );
    this.runtimeState.reviewId = payload.item.review.reviewId;
    await loadReviewsAction(this.hosts.createRuntimeReadsHost());
    this.feedback.rememberActivity(
      "Review Created",
      `${payload.item.review.category} review saved for ${payload.item.review.testRunId}.`
    );
  }

  async updateReview(): Promise<void> {
    const payload = await updateReviewAction(
      this.hosts.createRuntimeActionsHost(() =>
        this.refreshCrossViewStateAfterRuntimeChange()
      )
    );
    this.runtimeState.reviewId = payload.item.review.reviewId;
    await loadReviewsAction(this.hosts.createRuntimeReadsHost());
    this.feedback.rememberActivity(
      "Review Updated",
      `${payload.item.review.category} review updated for ${payload.item.review.testRunId}.`
    );
  }

  async deleteReview(): Promise<void> {
    const payload = await deleteReviewAction(
      this.hosts.createRuntimeActionsHost(() =>
        this.refreshCrossViewStateAfterRuntimeChange()
      )
    );
    this.runtimeState.reviewId = "";
    await loadReviewsAction(this.hosts.createRuntimeReadsHost());
    this.feedback.rememberActivity(
      "Review Deleted",
      `Review ${payload.deletedReviewId} deleted.`
    );
  }

  async deleteGroupResults(): Promise<void> {
    const payload = await deleteGroupResultsAction(
      this.hosts.createRuntimeActionsHost(() =>
        this.refreshCrossViewStateAfterRuntimeChange()
      )
    );
    await Promise.all([
      loadDetailedResponsesAction(this.hosts.createRuntimeReadsHost()),
      loadReviewsAction(this.hosts.createRuntimeReadsHost())
    ]);
    this.feedback.rememberActivity(
      "Group Results Deleted",
      `${payload.deletion.deletedTestRunCount} run(s), ${payload.deletion.deletedResponseCount} response(s), and ${payload.deletion.deletedReviewCount} review(s) deleted for ${payload.deletion.groupKey}.`
    );
  }

  async participantHappyPathFlow(): Promise<void> {
    await runParticipantHappyPathFlow(createParticipantHappyPathFlowHost({
      participantLaunch: () => this.participantLaunch(),
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

  private hasWorkspaceScope(): boolean {
    return (
      this.uiState.workspace.tenantKey.trim() !== "" &&
      this.uiState.workspace.workspaceKey.trim() !== ""
    );
  }
}
