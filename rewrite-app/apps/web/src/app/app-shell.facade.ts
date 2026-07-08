import { Injectable, inject } from "@angular/core";

import type { GetRuntimeConfigResponse } from "@testcenter-rewrite-app/contracts";

import type { AppView } from "./rewrite-app-shell.types";
import { parseJsonDocument } from "./rewrite-app-shell.readers";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";
import { RewriteAppViewStateService } from "./rewrite-app-view-state.service";
import type { LiveContextSection } from "./live-context.component";

const localDemoParticipantLink = [
  "/participant?workspaceKey=demo-workspace",
  "loginKey=student-demo",
  "groupKey=group:student-demo",
  "bookletKey=booklet:demo"
].join("&");

@Injectable({ providedIn: "root" })
export class AppShellFacade {
  private readonly uiState = inject(RewriteAppUiStateService);
  private readonly viewState = inject(RewriteAppViewStateService);

  readonly renderVersion = this.uiState.renderVersion;
  readonly responseMeta = this.uiState.responseMeta;
  readonly lastResponse = this.uiState.lastResponse;
  readonly activeRequestLabel = this.uiState.activeRequestLabel;
  readonly errorMessage = this.uiState.errorMessage;
  readonly feedback = this.uiState.feedback;
  readonly ops = this.uiState.ops;
  readonly workspace = this.uiState.workspace;
  readonly content = this.uiState.content;
  readonly runtime = this.uiState.runtime;

  readonly views = [
    { id: "workspace", label: "Workspace", link: "/workspace" },
    { id: "content", label: "Content", link: "/content" },
    { id: "runtime", label: "Runtime", link: "/runtime" },
    { id: "participant", label: "Participant", link: "/participant" },
    { id: "ops", label: "Diagnostics", link: "/ops" }
  ] as const;

  get activeView(): AppView {
    return this.uiState.activeView;
  }

  get showRawDebug(): boolean {
    return this.uiState.showRawDebug;
  }

  get localDemoBootstrapEnabled(): boolean {
    const runtimeConfig = parseJsonDocument<GetRuntimeConfigResponse>(
      this.ops.runtimeConfigView
    )?.runtimeConfig;
    return runtimeConfig?.environment.firstSliceBootstrapDemo === true;
  }

  get localDemoParticipantLink(): string {
    return localDemoParticipantLink;
  }

  get lastResponsePreview(): string {
    const normalized = this.uiState.lastResponse().replace(/\s+/g, " ").trim();
    if (!normalized || normalized === "No request sent yet.") {
      return "No request has been sent from this browser session yet.";
    }
    return normalized.length > 260
      ? `${normalized.slice(0, 257)}...`
      : normalized;
  }

  toggleRawDebug(): void {
    this.uiState.showRawDebug = !this.uiState.showRawDebug;
    this.viewState.persistShellState();
  }

  get liveContextSections(): LiveContextSection[] {
    return [
      {
        title: "Workspace Scope",
        route: "/workspace",
        items: [
          { label: "Tenant", value: this.displayValue(this.workspace.tenantKey) },
          { label: "Workspace", value: this.displayValue(this.workspace.workspaceKey) }
        ]
      },
      {
        title: "Content Intake",
        route: "/content",
        items: [
          {
            label: "Source Package",
            value: this.displayValue(this.content.sourcePackageId)
          },
          { label: "Import Job", value: this.displayValue(this.content.importJobId) },
          {
            label: "Release",
            value: this.displayValue(this.content.contentReleaseId)
          }
        ]
      },
      {
        title: "Participant Runtime",
        route: "/participant",
        items: [
          {
            label: "Session",
            value: this.displayValue(this.runtime.participantSessionId)
          },
          { label: "Run", value: this.displayValue(this.runtime.testRunId) },
          {
            label: "Unit",
            value: this.displayValue(this.runtime.currentUnitKey)
          }
        ]
      },
      {
        title: "Admin Access",
        route: "/ops",
        items: [
          { label: "Admin", value: this.displayValue(this.ops.adminUsername) },
          {
            label: "Session",
            value: this.ops.adminSessionToken.trim() ? "signed in" : "not signed in"
          }
        ]
      }
    ];
  }

  init(initialView: AppView | null = null): void {
    this.viewState.init(initialView);
  }

  destroy(): void {
    this.viewState.destroy();
  }

  getPersistedView(): AppView {
    return this.viewState.getPersistedView();
  }

  private displayValue(value: string): string {
    return value.trim() || "not set";
  }
}
