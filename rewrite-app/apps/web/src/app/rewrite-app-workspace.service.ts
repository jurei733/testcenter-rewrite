import { Injectable, inject } from "@angular/core";

import type {
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
    await refreshWorkspaceOverviewAction(this.contentHosts.createContentReadsHost(), quiet);
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
}
