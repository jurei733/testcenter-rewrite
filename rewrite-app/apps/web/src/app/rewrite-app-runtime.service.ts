import { Injectable, inject } from "@angular/core";

import {
  type DeleteGroupResultsBulkResponse,
  type GetParticipantSessionResponse,
  type IssueMonitorRunCommandResponse,
  type IssueMonitorRunCommandsResponse,
  productionApiRoutes,
  resolveRoutePath
} from "@testcenter-rewrite-app/contracts";
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
  issueMonitorRunCommandsAction,
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
  loadGroupResultsAction,
  loadReviewsAction,
  refreshRuntimeReadsAction
} from "./rewrite-app-shell.runtime-reads";
import { runParticipantHappyPathFlow } from "./rewrite-app-shell.workflows";
import { RewriteAppContentService } from "./rewrite-app-content.service";
import { downloadBlobFile, downloadTextFile } from "./download-text-file";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";
import { RewriteAppWorkspaceService } from "./rewrite-app-workspace.service";
import { RewriteAppOperatorAccessService } from "./rewrite-app-operator-access.service";
import { RewriteAppShellRequestService } from "./rewrite-app-shell-request.service";

@Injectable({ providedIn: "root" })
export class RewriteAppRuntimeService {
  private readonly feedback = inject(RewriteAppShellFeedbackService);
  private readonly hosts = inject(RewriteAppShellRuntimeHostsService);
  private readonly presentationHosts = inject(RewriteAppShellRuntimePresentationService);
  private readonly uiState = inject(RewriteAppUiStateService);
  private readonly workspaceService = inject(RewriteAppWorkspaceService);
  private readonly contentService = inject(RewriteAppContentService);
  private readonly operatorAccess = inject(RewriteAppOperatorAccessService);
  private readonly requestState = inject(RewriteAppShellRequestService);

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
      | "lock_test"
      | "unlock_test"
      | "unlock_navigation"
      | "lock_navigation"
      | "set_testlet_time"
  ): Promise<IssueMonitorRunCommandResponse> {
    const result = await issueMonitorRunCommandAction(
      this.hosts.createRuntimeActionsHost(() =>
        this.refreshCrossViewStateAfterRuntimeChange()
      ),
      commandType
    );
    const activityTitle = {
      pause: "Monitor Pause Issued",
      resume: "Monitor Resume Issued",
      complete: "Monitor Complete Issued",
      goto: "Monitor Go To Issued",
      lock_test: "Monitor Test Locked",
      unlock_test: "Monitor Test Unlocked",
      unlock_navigation: "Monitor Navigation Unlocked",
      lock_navigation: "Monitor Navigation Locked",
      set_testlet_time: "Monitor Testlet Time Set"
    }[commandType];
    this.feedback.rememberActivity(
      activityTitle,
      `Monitor command '${commandType}' sent for ${this.runtimeState.testRunId || "the selected run"}.`
    );
    return result;
  }

  async issueMonitorRunCommands(
    testRunIds: string[],
    commandType:
      | "pause"
      | "resume"
      | "complete"
      | "goto"
      | "lock_test"
      | "unlock_test"
      | "unlock_navigation"
      | "lock_navigation"
      | "set_testlet_time"
  ): Promise<IssueMonitorRunCommandsResponse> {
    const result = await issueMonitorRunCommandsAction(
      this.hosts.createRuntimeActionsHost(() =>
        this.refreshCrossViewStateAfterRuntimeChange()
      ),
      testRunIds,
      commandType
    );
    this.feedback.rememberActivity(
      "Monitor Batch Command Issued",
      `${commandType}: ${result.succeededCount} succeeded, ${result.failedCount} failed.`
    );
    return result;
  }

  async refreshRuntimeReads(quiet = false): Promise<void> {
    if (!this.hasWorkspaceScope()) {
      return;
    }
    await refreshRuntimeReadsAction(
      this.hosts.createRuntimeReadsHost(),
      this.getParticipantSessionId(),
      quiet,
      { monitorOnly: this.operatorAccess.isMonitorOnly }
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
    const operationalCandidateCount =
      payload.operationalLoginCandidates.length;
    this.runtimeState.operationalLoginCandidatesView = JSON.stringify(
      { items: payload.operationalLoginCandidates },
      null,
      2
    );
    const operationalCandidateSummary = operationalCandidateCount
      ? `, ${operationalCandidateCount} operational login candidate${operationalCandidateCount === 1 ? "" : "s"} awaiting explicit role mapping`
      : "";
    this.feedback.rememberActivity(
      "Participant Roster Imported",
      `${payload.importedCount} imported, ${payload.updatedCount} updated${operationalCandidateSummary}.`
    );
    await this.refreshCrossViewStateAfterRuntimeChange();
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

  async exportSelectedGroupResponsesCsv(groupKeys: string[]): Promise<string> {
    return this.exportSelectedGroupCsv({
      groupKeys,
      route: productionApiRoutes.workspace.exportResponseCsv,
      label: "Selected Group Response CSV Export",
      filenameSuffix: "selected-responses",
      view: "responses"
    });
  }

  async exportSelectedGroupReviewsCsv(groupKeys: string[]): Promise<string> {
    return this.exportSelectedGroupCsv({
      groupKeys,
      route: productionApiRoutes.workspace.exportReviewCsv,
      label: "Selected Group Review CSV Export",
      filenameSuffix: "selected-reviews",
      view: "reviews"
    });
  }

  async exportSelectedGroupLogsCsv(groupKeys: string[]): Promise<string> {
    return this.exportSelectedGroupCsv({
      groupKeys,
      route: productionApiRoutes.workspace.exportLogCsv,
      label: "Selected Group Test Log CSV Export",
      filenameSuffix: "selected-logs",
      view: "logs"
    });
  }

  async exportSelectedGroupResultArchive(groupKeys: string[]): Promise<void> {
    const normalizedGroupKeys = this.normalizeSelectedGroupKeys(groupKeys);
    const download = await this.requestState.requestDownload(
      "Selected Group Original Result Archive Export",
      this.selectedGroupPath(
        productionApiRoutes.workspace.exportOriginalResultArchive,
        normalizedGroupKeys
      )
    );
    const workspaceKey = this.uiState.workspace.workspaceKey.trim() || "workspace";
    const filename =
      download.filename ?? `${workspaceKey}-original-results.zip`;
    downloadBlobFile({ filename, blob: download.blob });
    this.feedback.rememberActivity(
      "Original Result Archive Downloaded",
      `${filename} contains response, log, and review reports in Original-compatible CSV and JSON formats for ${normalizedGroupKeys.length} selected group(s).`
    );
  }

  async deleteSelectedGroupResults(
    groupKeys: string[],
    confirmation: string
  ): Promise<DeleteGroupResultsBulkResponse> {
    const normalizedGroupKeys = this.normalizeSelectedGroupKeys(groupKeys);
    const payload = await this.requestState.request<DeleteGroupResultsBulkResponse>(
      "Delete Selected Group Results",
      "DELETE",
      this.selectedGroupPath(
        productionApiRoutes.workspace.deleteGroupResultsBulk,
        []
      ),
      { groupKeys: normalizedGroupKeys, confirmation }
    );
    await Promise.all([
      loadGroupResultsAction(this.hosts.createRuntimeReadsHost()),
      loadDetailedResponsesAction(this.hosts.createRuntimeReadsHost()),
      loadReviewsAction(this.hosts.createRuntimeReadsHost())
    ]);
    this.feedback.rememberActivity(
      "Selected Group Results Deleted",
      `${payload.deletion.deletedTestRunCount} run(s), ${payload.deletion.deletedResponseCount} response(s), ${payload.deletion.deletedReviewCount} review(s), and ${payload.deletion.deletedTestLogCount} test log(s) deleted for ${payload.deletion.groupKeys.length} selected group(s).`
    );
    return payload;
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

  private async exportSelectedGroupCsv(input: {
    groupKeys: string[];
    route: string;
    label: string;
    filenameSuffix: string;
    view: "responses" | "reviews" | "logs";
  }): Promise<string> {
    const groupKeys = this.normalizeSelectedGroupKeys(input.groupKeys);
    const csv = await this.requestState.request<string>(
      input.label,
      "GET",
      this.selectedGroupPath(input.route, groupKeys, true)
    );
    const workspaceKey = this.uiState.workspace.workspaceKey.trim() || "workspace";
    downloadTextFile({
      filename: `${workspaceKey}-${input.filenameSuffix}.csv`,
      mediaType: "text/csv;charset=utf-8",
      text: csv
    });
    if (input.view === "responses") {
      this.runtimeState.responseExportView = csv;
    } else if (input.view === "reviews") {
      this.runtimeState.reviewExportView = csv;
    } else {
      this.uiState.workspace.workspaceLogExportView = csv;
    }
    this.feedback.rememberActivity(
      "Selected Group CSV Downloaded",
      `${input.filenameSuffix} export saved for ${groupKeys.length} selected group(s).`
    );
    return csv;
  }

  private selectedGroupPath(
    route: string,
    groupKeys: string[],
    includeExportLimit = false
  ): string {
    const path = resolveRoutePath(route, {
      tenantKey: this.uiState.workspace.tenantKey.trim(),
      workspaceKey: this.uiState.workspace.workspaceKey.trim()
    });
    const query = new URLSearchParams();
    for (const groupKey of groupKeys) {
      query.append("groupKey", groupKey);
    }
    if (includeExportLimit) {
      query.set("limit", "50000");
    }
    const queryString = query.toString();
    return queryString ? `${path}?${queryString}` : path;
  }

  private normalizeSelectedGroupKeys(groupKeys: string[]): string[] {
    const normalized = Array.from(
      new Set(groupKeys.map(groupKey => groupKey.trim()).filter(Boolean))
    ).sort();
    if (normalized.length === 0) {
      throw new Error("At least one result group must be selected.");
    }
    return normalized;
  }

  async loadGroupResults(): Promise<void> {
    if (!this.hasWorkspaceScope()) {
      return;
    }
    const payload = await loadGroupResultsAction(this.hosts.createRuntimeReadsHost());
    this.feedback.rememberActivity(
      "Result Groups Loaded",
      `${payload.items.length} result group(s) loaded.`
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
      loadGroupResultsAction(this.hosts.createRuntimeReadsHost()),
      loadDetailedResponsesAction(this.hosts.createRuntimeReadsHost()),
      loadReviewsAction(this.hosts.createRuntimeReadsHost())
    ]);
    this.feedback.rememberActivity(
      "Group Results Deleted",
      `${payload.deletion.deletedTestRunCount} run(s), ${payload.deletion.deletedResponseCount} response(s), ${payload.deletion.deletedReviewCount} review(s), and ${payload.deletion.deletedTestLogCount} test log(s) deleted for ${payload.deletion.groupKey}.`
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
    if (this.operatorAccess.isMonitorOnly) {
      await this.refreshRuntimeReads(true);
      return;
    }
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
