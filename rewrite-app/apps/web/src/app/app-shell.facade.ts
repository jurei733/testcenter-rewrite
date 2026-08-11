import { Injectable, inject } from "@angular/core";

import type { GetRuntimeConfigResponse } from "@testcenter-rewrite-app/contracts";

import type { AppView } from "./rewrite-app-shell.types";
import { buildParticipantEntryUrl } from "./participant-session-links";
import { parseJsonDocument } from "./rewrite-app-shell.readers";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";
import { RewriteAppOperatorAccessService } from "./rewrite-app-operator-access.service";
import { AdminPasswordChangeService } from "./admin-password-change.service";
import type { LiveContextSection } from "./live-context.component";
import { RewriteAppShellPersistenceService } from "./rewrite-app-shell-persistence.service";

const localDemoParticipantLink = buildParticipantEntryUrl(
  {
    tenantKey: "demo-tenant",
    workspaceKey: "demo-workspace",
    loginKey: "student-demo",
    groupKey: "group:student-demo",
    bookletKey: "booklet:demo"
  },
  { includeOrigin: false }
);

@Injectable({ providedIn: "root" })
export class AppShellFacade {
  private readonly uiState = inject(RewriteAppUiStateService);
  private readonly persistence = inject(RewriteAppShellPersistenceService);
  private readonly operatorAccess = inject(RewriteAppOperatorAccessService);
  private readonly adminPasswordChange = inject(AdminPasswordChangeService);

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

  private readonly adminViews = [
    { id: "workspace", label: "Workspace", link: "/workspace" },
    { id: "content", label: "Content", link: "/content" },
    { id: "runtime", label: "Runtime", link: "/runtime" },
    { id: "participant", label: "Participant", link: "/participant" },
    { id: "system-check", label: "System Check", link: "/system-check" },
    { id: "ops", label: "Diagnostics", link: "/ops" }
  ] as const;

  private readonly monitorViews = [
    { id: "runtime", label: "Monitor", link: "/runtime" },
    { id: "ops", label: "Access & Diagnostics", link: "/ops" }
  ] as const;

  private readonly systemCheckViews = [
    { id: "system-check", label: "System Check", link: "/system-check" }
  ] as const;

  get views(): ReadonlyArray<{ id: AppView; label: string; link: string }> {
    if (this.operatorAccess.isSystemCheckOnly) {
      return this.systemCheckViews;
    }
    return this.operatorAccess.isMonitorOnly ? this.monitorViews : this.adminViews;
  }

  get isMonitorOnlySession(): boolean {
    return this.operatorAccess.isMonitorOnly;
  }

  get isReadOnlyAdminSession(): boolean {
    return this.operatorAccess.isReadOnlyAdmin;
  }

  get requiresAdminPasswordChange(): boolean {
    return this.operatorAccess.requiresPasswordChange;
  }

  get hasAdminSession(): boolean {
    return this.ops.adminSessionToken.trim() !== "";
  }

  async changeRequiredAdminPassword(password: string): Promise<void> {
    await this.adminPasswordChange.changePassword({ password });
  }

  async changeOwnAdminPassword(
    currentPassword: string,
    password: string
  ): Promise<void> {
    await this.adminPasswordChange.changePassword({
      currentPassword,
      password
    });
  }

  async signOutRequiredAdmin(): Promise<void> {
    await this.adminPasswordChange.signOut();
  }

  async signOutAdmin(): Promise<void> {
    await this.adminPasswordChange.signOut();
  }

  get operatorAccessLabel(): string {
    return this.operatorAccess.label;
  }

  get operatorAccountUsername(): string {
    return this.operatorAccess.username;
  }

  get operatorAccountDisplayName(): string {
    return this.operatorAccess.displayName;
  }

  get operatorAccountSessionExpiresAt(): string {
    return this.operatorAccess.sessionExpiresAt;
  }

  get operatorAccountAccessItems() {
    return this.operatorAccess.accountAccessItems;
  }

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

  get localDemoStartupHeadline(): string {
    if (this.ops.readinessBadge === "ready") {
      return "Local demo is ready to use";
    }
    return `Local demo detected, readiness ${this.ops.readinessBadge}`;
  }

  get localDemoScopeLabel(): string {
    return "demo-tenant / demo-workspace";
  }

  get localDemoAdminCredential(): string {
    return "demo-admin / demo-admin-password";
  }

  get localDemoParticipantCredential(): string {
    return "student-demo";
  }

  get localDemoRuntimeDetail(): string {
    const storage = this.displayValue(this.ops.storageKind);
    const schema = this.displayValue(this.ops.storageSchemaVersion);
    const auth = this.displayValue(this.ops.operatorAuthMode);
    return `Storage ${storage}, schema ${schema}, auth ${auth}`;
  }

  get localDemoBuildDetail(): string {
    return `Build ${this.displayValue(this.ops.buildRef)}`;
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
    this.persistence.persistShellState();
  }

  get liveContextSections(): LiveContextSection[] {
    if (this.operatorAccess.isMonitorOnly) {
      return [
        {
          title: "Monitor Scope",
          route: "/runtime",
          items: [
            { label: "Tenant", value: this.displayValue(this.workspace.tenantKey) },
            {
              label: "Workspace",
              value: this.displayValue(this.workspace.workspaceKey)
            },
            { label: "Access", value: this.operatorAccess.label },
            {
              label: "Selected Run",
              value: this.displayValue(this.runtime.testRunId)
            }
          ]
        },
        {
          title: "Operator Session",
          route: "/ops",
          items: [
            { label: "Operator", value: this.displayValue(this.ops.adminUsername) },
            { label: "Role", value: this.operatorAccess.label },
            {
              label: "Session",
              value: this.ops.adminSessionToken.trim() ? "signed in" : "not signed in"
            }
          ]
        }
      ];
    }
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
            label: "Participant",
            value: this.displayValue(
              this.runtime.participantDisplayName || this.runtime.loginKey
            )
          },
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
    this.persistence.hydrateShellState();
    if (initialView) {
      this.uiState.activeView = initialView;
      this.persistence.persistShellState();
    }
  }

  getPersistedView(): AppView {
    return this.uiState.activeView;
  }

  private displayValue(value: string): string {
    return value.trim() || "not set";
  }
}
