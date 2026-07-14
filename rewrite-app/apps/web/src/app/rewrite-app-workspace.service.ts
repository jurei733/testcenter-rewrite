import { Injectable, inject } from "@angular/core";

import type {
  GetStudyMonitorBookletResponse,
  GetStudyMonitorGroupResponse,
  GetStudyMonitorParticipantResponse,
  GetStudyMonitorParticipantMatrixResponse,
  GetStudyMonitorRunResponse,
  GetStudyMonitorSummaryResponse,
  GetStudyMonitorUnitResponse,
  ListWorkspaceActivityEventsResponse,
  ListTenantsResponse,
  ListWorkspacesResponse
} from "@testcenter-rewrite-app/contracts";
import {
  productionApiRoutes,
  resolveRoutePath
} from "@testcenter-rewrite-app/contracts";

import { RewriteAppApiService } from "./rewrite-app-api.service";
import { RewriteAppShellContentHostsService } from "./rewrite-app-shell-content-hosts.service";
import { refreshWorkspaceOverviewAction } from "./rewrite-app-shell.content-reads";
import { RewriteAppShellFeedbackService } from "./rewrite-app-shell-feedback.service";
import { RewriteAppShellRequestService } from "./rewrite-app-shell-request.service";
import { RewriteAppShellWorkspaceHostsService } from "./rewrite-app-shell-workspace-hosts.service";
import { createBootstrapWorkspaceFlowHost } from "./rewrite-app-shell.hosts";
import { downloadTextFile } from "./download-text-file";
import { prettyPrintJson } from "./rewrite-app-shell.readers";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";
import { runBootstrapWorkspaceFlow } from "./rewrite-app-shell.workflows";
import {
  createTenantAction,
  createWorkspaceAction
} from "./rewrite-app-shell.workspace-actions";

@Injectable({ providedIn: "root" })
export class RewriteAppWorkspaceService {
  private readonly api = inject(RewriteAppApiService);
  private readonly contentHosts = inject(RewriteAppShellContentHostsService);
  private readonly hosts = inject(RewriteAppShellWorkspaceHostsService);
  private readonly feedback = inject(RewriteAppShellFeedbackService);
  private readonly requestState = inject(RewriteAppShellRequestService);
  private readonly uiState = inject(RewriteAppUiStateService);

  private readonly workspaceState = this.uiState.workspace;

  async createTenant(): Promise<void> {
    await createTenantAction(this.hosts.createWorkspaceActionsHost());
  }

  async createWorkspace(): Promise<void> {
    await createWorkspaceAction(this.hosts.createWorkspaceActionsHost());
  }

  async refreshWorkspaceOverview(quiet = false): Promise<void> {
    if (!this.hasWorkspaceScope()) {
      return;
    }
    await refreshWorkspaceOverviewAction(this.contentHosts.createContentReadsHost(), quiet);
  }

  async refreshStudyMonitor(quiet = false): Promise<void> {
    if (!this.hasWorkspaceScope()) {
      return;
    }
    const tenantKey = this.workspaceState.tenantKey.trim();
    const workspaceKey = this.workspaceState.workspaceKey.trim();
    const [payload, participantMatrixPayload] = await Promise.all([
      this.requestState.request<GetStudyMonitorSummaryResponse>(
        "Study Monitor Summary",
        "GET",
        resolveRoutePath(productionApiRoutes.workspace.getStudyMonitorSummary, {
          tenantKey,
          workspaceKey
        }),
        undefined,
        { quiet }
      ),
      this.requestState.request<GetStudyMonitorParticipantMatrixResponse>(
        "Study Monitor Participant Matrix",
        "GET",
        this.getStudyMonitorParticipantMatrixPath(tenantKey, workspaceKey),
        undefined,
        { quiet }
      )
    ]);

    this.workspaceState.studyMonitorView = prettyPrintJson(
      payload,
      this.workspaceState.studyMonitorView
    );
    this.workspaceState.studyMonitorParticipantMatrixView = prettyPrintJson(
      participantMatrixPayload,
      this.workspaceState.studyMonitorParticipantMatrixView
    );
    if (!quiet) {
      this.feedback.rememberActivity(
        "Study Monitor Refreshed",
        `${payload.studyMonitorSummary.groups.length} group(s), ${participantMatrixPayload.studyMonitorParticipantMatrix.rows.length} participant-unit row(s).`
      );
    }
  }

  async refreshWorkspaceActivity(quiet = false): Promise<void> {
    if (!this.hasWorkspaceScope()) {
      return;
    }
    const host = this.contentHosts.createContentReadsHost();
    const payload = await this.requestState.request<ListWorkspaceActivityEventsResponse>(
      "Workspace Activity",
      "GET",
      host.getWorkspaceActivityPath(),
      undefined,
      { quiet }
    );

    this.workspaceState.workspaceActivityView = prettyPrintJson(
      payload,
      this.workspaceState.workspaceActivityView
    );
    if (!quiet) {
      this.feedback.rememberActivity(
        "Workspace Activity Refreshed",
        `${payload.items.length} event(s) loaded with the current timeline filters.`
      );
    }
  }

  async loadStudyMonitorGroup(groupKey: string): Promise<void> {
    if (!this.hasWorkspaceScope()) {
      return;
    }
    const tenantKey = this.workspaceState.tenantKey.trim();
    const workspaceKey = this.workspaceState.workspaceKey.trim();
    const payload = await this.requestState.request<GetStudyMonitorGroupResponse>(
      "Study Monitor Group",
      "GET",
      resolveRoutePath(productionApiRoutes.workspace.getStudyMonitorGroup, {
        tenantKey,
        workspaceKey,
        groupKey
      })
    );

    this.workspaceState.studyMonitorGroupView = prettyPrintJson(
      payload,
      this.workspaceState.studyMonitorGroupView
    );
    this.feedback.rememberActivity(
      "Study Monitor Group Loaded",
      `${payload.studyMonitorGroup.groupKey}: ${payload.studyMonitorGroup.participantSessionCount} session(s), ${payload.studyMonitorGroup.testRunCount} run(s).`
    );
  }

  async loadStudyMonitorParticipant(loginKey: string): Promise<void> {
    if (!this.hasWorkspaceScope()) {
      return;
    }
    const tenantKey = this.workspaceState.tenantKey.trim();
    const workspaceKey = this.workspaceState.workspaceKey.trim();
    const payload =
      await this.requestState.request<GetStudyMonitorParticipantResponse>(
        "Study Monitor Participant",
        "GET",
        resolveRoutePath(productionApiRoutes.workspace.getStudyMonitorParticipant, {
          tenantKey,
          workspaceKey,
          loginKey
        })
      );

    this.workspaceState.studyMonitorParticipantView = prettyPrintJson(
      payload,
      this.workspaceState.studyMonitorParticipantView
    );
    this.feedback.rememberActivity(
      "Study Monitor Participant Loaded",
      `${payload.studyMonitorParticipant.loginKey}: ${payload.studyMonitorParticipant.testRunCount} run(s), ${payload.studyMonitorParticipant.responseCount} response(s).`
    );
  }

  async loadStudyMonitorBooklet(bookletKey: string): Promise<void> {
    if (!this.hasWorkspaceScope()) {
      return;
    }
    const tenantKey = this.workspaceState.tenantKey.trim();
    const workspaceKey = this.workspaceState.workspaceKey.trim();
    const payload = await this.requestState.request<GetStudyMonitorBookletResponse>(
      "Study Monitor Booklet",
      "GET",
      resolveRoutePath(productionApiRoutes.workspace.getStudyMonitorBooklet, {
        tenantKey,
        workspaceKey,
        bookletKey
      })
    );

    this.workspaceState.studyMonitorBookletView = prettyPrintJson(
      payload,
      this.workspaceState.studyMonitorBookletView
    );
    this.feedback.rememberActivity(
      "Study Monitor Booklet Loaded",
      `${payload.studyMonitorBooklet.bookletKey}: ${payload.studyMonitorBooklet.testRunCount} run(s), ${payload.studyMonitorBooklet.responseCount} response(s).`
    );
  }

  async loadStudyMonitorUnit(unitKey: string): Promise<void> {
    if (!this.hasWorkspaceScope()) {
      return;
    }
    const tenantKey = this.workspaceState.tenantKey.trim();
    const workspaceKey = this.workspaceState.workspaceKey.trim();
    const payload = await this.requestState.request<GetStudyMonitorUnitResponse>(
      "Study Monitor Unit",
      "GET",
      resolveRoutePath(productionApiRoutes.workspace.getStudyMonitorUnit, {
        tenantKey,
        workspaceKey,
        unitKey
      })
    );

    this.workspaceState.studyMonitorUnitView = prettyPrintJson(
      payload,
      this.workspaceState.studyMonitorUnitView
    );
    this.feedback.rememberActivity(
      "Study Monitor Unit Loaded",
      `${payload.studyMonitorUnit.unitKey}: ${payload.studyMonitorUnit.responseCount}/${payload.studyMonitorUnit.expectedRunCount} answered.`
    );
  }

  async loadStudyMonitorRun(testRunId: string): Promise<void> {
    if (!this.hasWorkspaceScope()) {
      return;
    }
    const tenantKey = this.workspaceState.tenantKey.trim();
    const workspaceKey = this.workspaceState.workspaceKey.trim();
    const payload = await this.requestState.request<GetStudyMonitorRunResponse>(
      "Study Monitor Run",
      "GET",
      resolveRoutePath(productionApiRoutes.workspace.getStudyMonitorRun, {
        tenantKey,
        workspaceKey,
        testRunId
      })
    );

    this.workspaceState.studyMonitorRunView = prettyPrintJson(
      payload,
      this.workspaceState.studyMonitorRunView
    );
    this.feedback.rememberActivity(
      "Study Monitor Run Loaded",
      `${payload.studyMonitorRun.testRun.testRunId}: ${payload.studyMonitorRun.responseCount}/${payload.studyMonitorRun.expectedUnitCount} response(s), ${payload.studyMonitorRun.reviewCount} review(s).`
    );
  }

  async refreshTenantDirectory(): Promise<void> {
    const payload = await this.requestState.request<ListTenantsResponse>(
      "Tenant Directory",
      "GET",
      productionApiRoutes.platform.listTenants
    );

    this.workspaceState.tenantsView = prettyPrintJson(
      payload,
      this.workspaceState.tenantsView
    );
    this.feedback.rememberActivity(
      "Tenant Directory Refreshed",
      `${payload.items.length} tenant(s) loaded.`
    );
  }

  async refreshWorkspaceDirectory(): Promise<void> {
    if (!this.hasTenantScope()) {
      return;
    }
    const tenantKey = this.workspaceState.tenantKey.trim();
    const payload = await this.requestState.request<ListWorkspacesResponse>(
      "Workspace Directory",
      "GET",
      resolveRoutePath(productionApiRoutes.workspace.listWorkspaces, { tenantKey })
    );

    this.workspaceState.workspacesView = prettyPrintJson(
      payload,
      this.workspaceState.workspacesView
    );
    this.feedback.rememberActivity(
      "Workspace Directory Refreshed",
      `${payload.items.length} workspace(s) loaded for ${tenantKey}.`
    );
  }

  async exportWorkspaceLogCsv(): Promise<string> {
    if (!this.hasWorkspaceScope()) {
      return "";
    }
    const tenantKey = this.workspaceState.tenantKey.trim();
    const workspaceKey = this.workspaceState.workspaceKey.trim();
    const csv = await this.requestState.request<string>(
      "Workspace Log CSV Export",
      "GET",
      resolveRoutePath(productionApiRoutes.workspace.exportLogCsv, {
        tenantKey,
        workspaceKey
      })
    );

    this.workspaceState.workspaceLogExportView = csv;
    downloadTextFile({
      filename: `${workspaceKey || "workspace"}-logs.csv`,
      mediaType: "text/csv;charset=utf-8",
      text: csv
    });
    this.feedback.rememberActivity(
      "Workspace Log Exported",
      `CSV log export loaded for ${tenantKey}/${workspaceKey}.`
    );
    return csv;
  }

  async exportStudyMonitorCsv(): Promise<string> {
    if (!this.hasWorkspaceScope()) {
      return "";
    }
    const tenantKey = this.workspaceState.tenantKey.trim();
    const workspaceKey = this.workspaceState.workspaceKey.trim();
    const csv = await this.requestState.request<string>(
      "Study Monitor CSV Export",
      "GET",
      resolveRoutePath(productionApiRoutes.workspace.exportStudyMonitorCsv, {
        tenantKey,
        workspaceKey
      })
    );

    this.workspaceState.studyMonitorExportView = csv;
    downloadTextFile({
      filename: `${workspaceKey || "workspace"}-study-monitor.csv`,
      mediaType: "text/csv;charset=utf-8",
      text: csv
    });
    this.feedback.rememberActivity(
      "Study Monitor Exported",
      `CSV study monitor export loaded for ${tenantKey}/${workspaceKey}.`
    );
    return csv;
  }

  async exportStudyMonitorParticipantMatrixCsv(): Promise<string> {
    if (!this.hasWorkspaceScope()) {
      return "";
    }
    const tenantKey = this.workspaceState.tenantKey.trim();
    const workspaceKey = this.workspaceState.workspaceKey.trim();
    const exportPath = this.getStudyMonitorParticipantMatrixPath(
      tenantKey,
      workspaceKey,
      productionApiRoutes.workspace.exportStudyMonitorParticipantMatrixCsv
    );
    const csv = await this.requestState.request<string>(
      "Study Monitor Participant Matrix CSV Export",
      "GET",
      exportPath
    );

    this.workspaceState.studyMonitorParticipantMatrixExportView = csv;
    downloadTextFile({
      filename: `${workspaceKey || "workspace"}-study-monitor-participants.csv`,
      mediaType: "text/csv;charset=utf-8",
      text: csv
    });
    this.feedback.rememberActivity(
      "Participant Matrix Exported",
      `CSV participant monitor matrix loaded for ${tenantKey}/${workspaceKey}.`
    );
    return csv;
  }

  async bootstrapWorkspaceFlow(): Promise<void> {
    await runBootstrapWorkspaceFlow(createBootstrapWorkspaceFlowHost({
      createTenant: () => this.createTenant(),
      createWorkspace: () => this.createWorkspace(),
      refreshWorkspaceOverview: () => this.refreshWorkspaceOverview(),
      rememberActivity: (title: string, detail: string) => {
        this.feedback.rememberActivity(title, detail);
      },
      tenantKey: this.workspaceState.tenantKey,
      workspaceKey: this.workspaceState.workspaceKey,
      allowConflict: <T>(operation: () => Promise<T>, allowedErrorCodes: string[]) =>
        this.allowConflict(operation, allowedErrorCodes)
    }));
  }

  private async allowConflict<T>(
    operation: () => Promise<T>,
    allowedErrorCodes: string[]
  ): Promise<T | undefined> {
    try {
      return await operation();
    } catch (error) {
      if (this.api.isApiError(error) && allowedErrorCodes.includes(error.error)) {
        this.feedback.rememberActivity(
          "Guided Flow",
          `${error.message} Continuing with the existing resource.`
        );
        return undefined;
      }
      throw error;
    }
  }

  private hasWorkspaceScope(): boolean {
    return (
      this.hasTenantScope() &&
      this.workspaceState.workspaceKey.trim() !== ""
    );
  }

  private getStudyMonitorParticipantMatrixPath(
    tenantKey: string,
    workspaceKey: string,
    route: string = productionApiRoutes.workspace.getStudyMonitorParticipantMatrix
  ): string {
    const path = resolveRoutePath(route, {
      tenantKey,
      workspaceKey
    });
    const query = new URLSearchParams();
    const matrixFilters: Array<[string, string]> = [
      ["loginKey", this.workspaceState.studyMonitorMatrixLoginFilter],
      ["groupKey", this.workspaceState.studyMonitorMatrixGroupFilter],
      ["unitKey", this.workspaceState.studyMonitorMatrixUnitFilter],
      ["testRunStatus", this.workspaceState.studyMonitorMatrixStatusFilter],
      ["answerState", this.workspaceState.studyMonitorMatrixAnswerFilter],
      ["limit", this.workspaceState.studyMonitorMatrixLimit]
    ];
    for (const [key, value] of matrixFilters) {
      const trimmedValue = value.trim();
      if (trimmedValue) {
        query.set(key, trimmedValue);
      }
    }

    const encodedQuery = query.toString();
    return encodedQuery ? `${path}?${encodedQuery}` : path;
  }

  private hasTenantScope(): boolean {
    return this.workspaceState.tenantKey.trim() !== "";
  }
}
