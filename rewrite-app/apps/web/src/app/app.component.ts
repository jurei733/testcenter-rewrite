import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";

import {
  type ActivateContentReleaseResponse,
  type ApiErrorResponse,
  type CreateImportJobRequest,
  type CreateImportJobResponse,
  type CreateSourcePackageRequest,
  type CreateSourcePackageResponse,
  type CreateTenantRequest,
  type CreateTenantResponse,
  type CreateWorkspaceRequest,
  type CreateWorkspaceResponse,
  type GetContentReleaseActivationReadinessResponse,
  type GetContentReleaseResponse,
  type GetImportJobResponse,
  type GetParticipantSessionResponse,
  type GetRuntimeConfigResponse,
  type GetRuntimeDiagnosticsResponse,
  type GetSourcePackageResponse,
  type GetWorkspaceOverviewResponse,
  type ListContentReleasesResponse,
  type ListImportJobsResponse,
  type ListParticipantSessionsResponse,
  type ListSourcePackagesResponse,
  type ListWorkspaceActivityEventsResponse,
  type MonitorOpenRunsResponse,
  type ParticipantCurrentRunStateResponse,
  type ParticipantRuntimeStateResponse,
  type ParticipantSignInRequest,
  type ParticipantSignInResponse,
  type ResumeParticipantSessionResponse,
  type ResumeTestRunResponse,
  type RetrySourcePackageImportRequest,
  type RetrySourcePackageImportResponse,
  type SaveTestRunProgressRequest,
  type SaveTestRunProgressResponse,
  productionApiRoutes,
  resolveRoutePath
} from "@testcenter-rewrite-app/contracts";
import { ActivityFeedComponent } from "./activity-feed.component";
import { JsonPanelComponent } from "./json-panel.component";
import { SummaryCardsComponent } from "./summary-cards.component";

type AppView = "workspace" | "content" | "runtime" | "ops";

type AppAction =
  | "createTenant"
  | "createWorkspace"
  | "getWorkspaceOverview"
  | "createSourcePackage"
  | "createImportJob"
  | "activateContentRelease"
  | "refreshContentReads"
  | "participantSignIn"
  | "resumeSession"
  | "refreshRuntimeReads"
  | "getRuntimeState"
  | "getCurrentRunState"
  | "saveProgressPaused"
  | "saveProgressRunning"
  | "resumeRun"
  | "completeRun"
  | "openRuns"
  | "getSourcePackageDetail"
  | "getImportJobDetail"
  | "getParticipantSessionDetail"
  | "getContentReleaseActivationReadiness"
  | "getContentReleaseDetail"
  | "retrySourcePackageImport"
  | "bootstrapWorkspaceFlow"
  | "importActivateFlow"
  | "participantHappyPathFlow"
  | "refreshOperationalDiagnostics"
  | "refreshMetricsOnly";

type SummaryCard = {
  label: string;
  headline: string;
  detail: string;
};

type ActivityFeedItem = {
  title: string;
  detail: string;
};

type PersistedShellState = {
  tenantKey: string;
  workspaceKey: string;
  sourceFileName: string;
  sourceMediaType: string;
  sourceDocument: string;
  sourcePackageId: string;
  importJobId: string;
  contentReleaseId: string;
  participantSessionId: string;
  testRunId: string;
  currentUnitKey: string;
  loginKey: string;
  autoRefreshEnabled: boolean;
  autoRefreshSeconds: number;
  forceActivation: boolean;
  activeView: AppView;
};

type ApiErrorLike = ApiErrorResponse & {
  statusCode?: number;
};

const SHELL_STORAGE_KEY = "testcenter-rewrite-app-shell";
const DEFAULT_SOURCE_DOCUMENT =
  '<assessment><booklet key="booklet:starter" label="Starter"><unit key="unit-1" label="Entry" /></booklet></assessment>';

const createInitialSummaryCards = (): SummaryCard[] => [
  {
    label: "Workspace",
    headline: "Idle",
    detail: "Run setup or refresh the workspace overview to build the first summary snapshot."
  },
  {
    label: "Content",
    headline: "Waiting",
    detail: "Create and import a source package to surface activation and diagnostics state here."
  },
  {
    label: "Runtime",
    headline: "No Session",
    detail: "Sign in a participant to see current runtime status, current unit, and available actions."
  },
  {
    label: "Monitor",
    headline: "No Signal",
    detail: "Open the monitor view to track whether active runs are blocking a new release activation."
  }
];

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ActivityFeedComponent,
    JsonPanelComponent,
    SummaryCardsComponent
  ],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css"
})
export class AppComponent implements OnInit, OnDestroy {
  readonly views = [
    { id: "workspace" as const, label: "Workspace" },
    { id: "content" as const, label: "Content" },
    { id: "runtime" as const, label: "Runtime" },
    { id: "ops" as const, label: "Diagnostics" }
  ];

  storageKind = "unknown";
  storageSchemaVersion = "n/a";
  readinessBadge = "unknown";
  activeView: AppView = "workspace";

  tenantKey = "demo-tenant";
  workspaceKey = "demo-workspace";
  autoRefreshEnabled = true;
  autoRefreshSeconds = 8;

  sourceFileName = "frontend-starter.xml";
  sourceMediaType = "application/xml";
  sourceDocument = DEFAULT_SOURCE_DOCUMENT;
  sourcePackageId = "";
  importJobId = "";
  contentReleaseId = "";
  forceActivation = false;

  loginKey = "student-ui";
  participantSessionId = "";
  testRunId = "";
  currentUnitKey = "unit-1";

  responseMeta = "Idle";
  lastResponse = "No request sent yet.";
  activeRequestLabel: string | null = null;
  errorMessage: string | null = null;

  workspaceOverviewView = 'Use "Refresh Workspace Overview".';
  workspaceActivityView = 'Use "Refresh Content Reads".';
  sourcePackagesView = 'Use "Refresh Content Reads".';
  importJobsView = 'Use "Refresh Content Reads".';
  participantSessionsView = 'Use "Refresh Content Reads".';
  contentReleasesView = 'Use "Refresh Content Reads".';
  sourcePackageDetailView = 'Use "Source Package Detail".';
  importJobDetailView = 'Use "Import Job Detail".';
  participantSessionDetailView = 'Use "Participant Session Detail".';
  contentReleaseActivationReadinessView = 'Use "Release Readiness".';
  contentReleaseDetailView = 'Use "Release Detail".';
  runtimeStateView = 'Use "Refresh Runtime Reads".';
  currentRunStateView = 'Use "Refresh Runtime Reads".';
  openRunsView = 'Use "Refresh Runtime Reads".';
  runtimeMonitorView = "Use runtime actions to populate the latest action result.";
  runtimeHealthView = 'Use "Refresh Diagnostics".';
  runtimeMetricsView = 'Use "Refresh Diagnostics".';
  runtimeDiagnosticsView = 'Use "Refresh Diagnostics".';
  runtimeConfigView = 'Use "Refresh Diagnostics".';

  summaryCards = createInitialSummaryCards();
  activityFeed: ActivityFeedItem[] = [
    {
      title: "Ready",
      detail: "The Angular shell is waiting for the first API action."
    }
  ];

  private workspaceLoaded = false;
  private contentLoaded = false;
  private runtimeLoaded = false;
  private diagnosticsLoaded = false;
  private autoRefreshHandle: number | null = null;
  private foregroundRequestDepth = 0;
  private readonly onHashChange = () => {
    const view = this.readViewFromLocation();
    if (view && view !== this.activeView) {
      this.activeView = view;
      this.persistShellState();
      void this.ensureDataForView(view);
    }
  };

  ngOnInit(): void {
    this.hydrateShellState();
    const initialView = this.readViewFromLocation();
    if (initialView) {
      this.activeView = initialView;
    } else {
      this.syncLocationHash(this.activeView);
    }
    window.addEventListener("hashchange", this.onHashChange);
    this.scheduleAutoRefresh();
    void this.refreshOperationalDiagnostics(true);
    void this.ensureDataForView(this.activeView);
  }

  ngOnDestroy(): void {
    window.removeEventListener("hashchange", this.onHashChange);
    if (this.autoRefreshHandle != null) {
      window.clearInterval(this.autoRefreshHandle);
      this.autoRefreshHandle = null;
    }
  }

  isViewVisible(view: AppView): boolean {
    return this.activeView === view;
  }

  setActiveView(view: AppView): void {
    this.activeView = view;
    this.persistShellState();
    this.syncLocationHash(view);
    void this.ensureDataForView(view);
  }

  onAutoRefreshSettingsChanged(): void {
    this.autoRefreshSeconds = Math.max(3, Number(this.autoRefreshSeconds) || 8);
    this.persistShellState();
    this.scheduleAutoRefresh();
  }

  onAction(action: AppAction): void {
    void this.executeAction(action).catch(() => undefined);
  }

  persistShellState(): void {
    const snapshot: PersistedShellState = {
      tenantKey: this.tenantKey,
      workspaceKey: this.workspaceKey,
      sourceFileName: this.sourceFileName,
      sourceMediaType: this.sourceMediaType,
      sourceDocument: this.sourceDocument,
      sourcePackageId: this.sourcePackageId,
      importJobId: this.importJobId,
      contentReleaseId: this.contentReleaseId,
      participantSessionId: this.participantSessionId,
      testRunId: this.testRunId,
      currentUnitKey: this.currentUnitKey,
      loginKey: this.loginKey,
      autoRefreshEnabled: this.autoRefreshEnabled,
      autoRefreshSeconds: this.autoRefreshSeconds,
      forceActivation: this.forceActivation,
      activeView: this.activeView
    };

    window.localStorage.setItem(SHELL_STORAGE_KEY, JSON.stringify(snapshot));
  }

  private hydrateShellState(): void {
    const rawValue = window.localStorage.getItem(SHELL_STORAGE_KEY);
    if (!rawValue) {
      return;
    }

    try {
      const snapshot = JSON.parse(rawValue) as Partial<PersistedShellState>;
      this.tenantKey = snapshot.tenantKey ?? this.tenantKey;
      this.workspaceKey = snapshot.workspaceKey ?? this.workspaceKey;
      this.sourceFileName = snapshot.sourceFileName ?? this.sourceFileName;
      this.sourceMediaType = snapshot.sourceMediaType ?? this.sourceMediaType;
      this.sourceDocument = snapshot.sourceDocument ?? this.sourceDocument;
      this.sourcePackageId = snapshot.sourcePackageId ?? this.sourcePackageId;
      this.importJobId = snapshot.importJobId ?? this.importJobId;
      this.contentReleaseId = snapshot.contentReleaseId ?? this.contentReleaseId;
      this.participantSessionId =
        snapshot.participantSessionId ?? this.participantSessionId;
      this.testRunId = snapshot.testRunId ?? this.testRunId;
      this.currentUnitKey = snapshot.currentUnitKey ?? this.currentUnitKey;
      this.loginKey = snapshot.loginKey ?? this.loginKey;
      this.autoRefreshEnabled = snapshot.autoRefreshEnabled ?? this.autoRefreshEnabled;
      this.autoRefreshSeconds = snapshot.autoRefreshSeconds ?? this.autoRefreshSeconds;
      this.forceActivation = snapshot.forceActivation ?? this.forceActivation;
      this.activeView = snapshot.activeView ?? this.activeView;
    } catch {
      // Ignore broken browser state and keep defaults.
    }
  }

  private readViewFromLocation(): AppView | null {
    const nextHash = window.location.hash.replace(/^#/, "");
    if (nextHash === "workspace" || nextHash === "content" || nextHash === "runtime" || nextHash === "ops") {
      return nextHash;
    }
    return null;
  }

  private syncLocationHash(view: AppView): void {
    const nextHash = `#${view}`;
    if (window.location.hash !== nextHash) {
      history.replaceState(null, "", nextHash);
    }
  }

  private scheduleAutoRefresh(): void {
    if (this.autoRefreshHandle != null) {
      window.clearInterval(this.autoRefreshHandle);
      this.autoRefreshHandle = null;
    }

    if (!this.autoRefreshEnabled) {
      return;
    }

    const refreshSeconds = Math.max(3, Number(this.autoRefreshSeconds) || 8);
    this.autoRefreshHandle = window.setInterval(() => {
      void this.refreshActiveViewData();
    }, refreshSeconds * 1000);
  }

  private async refreshActiveViewData(): Promise<void> {
    try {
      if (this.activeView === "workspace") {
        await this.refreshWorkspaceOverview(true);
        return;
      }
      if (this.activeView === "content") {
        await this.refreshContentReads(true);
        return;
      }
      if (this.activeView === "runtime") {
        await this.refreshRuntimeReads(true);
        return;
      }
      await this.refreshOperationalDiagnostics(true);
    } catch {
      // Keep background refresh best-effort only.
    }
  }

  private async ensureDataForView(view: AppView): Promise<void> {
    if (view === "workspace" && !this.workspaceLoaded) {
      await this.refreshWorkspaceOverview(true).catch(() => undefined);
      return;
    }
    if (view === "content" && !this.contentLoaded) {
      await this.refreshContentReads(true).catch(() => undefined);
      return;
    }
    if (view === "runtime" && !this.runtimeLoaded) {
      await this.refreshRuntimeReads(true).catch(() => undefined);
      return;
    }
    if (view === "ops" && !this.diagnosticsLoaded) {
      await this.refreshOperationalDiagnostics(true).catch(() => undefined);
    }
  }

  private async executeAction(action: AppAction): Promise<void> {
    switch (action) {
      case "createTenant":
        await this.createTenant();
        return;
      case "createWorkspace":
        await this.createWorkspace();
        return;
      case "getWorkspaceOverview":
        await this.refreshWorkspaceOverview();
        return;
      case "createSourcePackage":
        await this.createSourcePackage();
        return;
      case "createImportJob":
        await this.createImportJob();
        return;
      case "activateContentRelease":
        await this.activateContentRelease();
        return;
      case "refreshContentReads":
        await this.refreshContentReads();
        return;
      case "participantSignIn":
        await this.participantSignIn();
        return;
      case "resumeSession":
        await this.resumeParticipantSession();
        return;
      case "refreshRuntimeReads":
      case "getRuntimeState":
      case "getCurrentRunState":
      case "openRuns":
        await this.refreshRuntimeReads();
        return;
      case "saveProgressPaused":
        await this.saveProgress("paused");
        return;
      case "saveProgressRunning":
        await this.saveProgress("running");
        return;
      case "resumeRun":
        await this.resumeRun();
        return;
      case "completeRun":
        await this.completeRun();
        return;
      case "getSourcePackageDetail":
        await this.loadSourcePackageDetail();
        return;
      case "getImportJobDetail":
        await this.loadImportJobDetail();
        return;
      case "getParticipantSessionDetail":
        await this.loadParticipantSessionDetail();
        return;
      case "getContentReleaseActivationReadiness":
        await this.loadContentReleaseActivationReadiness();
        return;
      case "getContentReleaseDetail":
        await this.loadContentReleaseDetail();
        return;
      case "retrySourcePackageImport":
        await this.retrySourcePackageImport();
        return;
      case "bootstrapWorkspaceFlow":
        await this.bootstrapWorkspaceFlow();
        return;
      case "importActivateFlow":
        await this.importActivateFlow();
        return;
      case "participantHappyPathFlow":
        await this.participantHappyPathFlow();
        return;
      case "refreshOperationalDiagnostics":
        await this.refreshOperationalDiagnostics();
        return;
      case "refreshMetricsOnly":
        await this.refreshMetricsOnly();
        return;
    }
  }

  private async createTenant(): Promise<void> {
    const payload = await this.request<CreateTenantResponse>(
      "Create Tenant",
      "POST",
      productionApiRoutes.platform.createTenant,
      {
        tenantKey: this.tenantKey.trim(),
        displayName: this.tenantKey.trim()
      } satisfies CreateTenantRequest
    );
    this.rememberActivity("Tenant Created", `Tenant ${payload.tenant.tenantKey} is ready.`);
  }

  private async createWorkspace(): Promise<void> {
    const payload = await this.request<CreateWorkspaceResponse>(
      "Create Workspace",
      "POST",
      resolveRoutePath(productionApiRoutes.workspace.createWorkspace, {
        tenantKey: this.tenantKey.trim()
      }),
      {
        workspaceKey: this.workspaceKey.trim(),
        displayName: this.workspaceKey.trim()
      } satisfies CreateWorkspaceRequest
    );
    this.rememberActivity(
      "Workspace Created",
      `Workspace ${payload.workspace.workspaceKey} is ready inside tenant ${this.tenantKey.trim()}.`
    );
  }

  private async createSourcePackage(): Promise<void> {
    const payload = await this.request<CreateSourcePackageResponse>(
      "Create Source Package",
      "POST",
      resolveRoutePath(productionApiRoutes.workspace.createSourcePackage, {
        tenantKey: this.tenantKey.trim(),
        workspaceKey: this.workspaceKey.trim()
      }),
      {
        fileName: this.sourceFileName.trim(),
        mediaType: this.sourceMediaType.trim(),
        sourceDocument: this.sourceDocument
      } satisfies CreateSourcePackageRequest
    );
    this.sourcePackageId = payload.sourcePackage.sourcePackageId;
    this.persistShellState();
    this.rememberActivity(
      "Source Package Created",
      `${payload.sourcePackage.fileName} uploaded as ${payload.sourcePackage.sourcePackageId}.`
    );
    await this.loadSourcePackageDetail();
  }

  private async createImportJob(): Promise<void> {
    const payload = await this.request<CreateImportJobResponse>(
      "Create Import Job",
      "POST",
      resolveRoutePath(productionApiRoutes.workspace.createImportJob, {
        tenantKey: this.tenantKey.trim(),
        workspaceKey: this.workspaceKey.trim()
      }),
      {
        sourcePackageId: this.getSourcePackageId()
      } satisfies CreateImportJobRequest
    );

    this.importJobId = payload.importJob.importJobId;
    this.contentReleaseId =
      payload.stagedContentRelease?.contentReleaseId ?? this.contentReleaseId;
    this.persistShellState();
    this.rememberActivity(
      "Import Started",
      `Import ${payload.importJob.importJobId} finished as ${payload.importJob.status}.`
    );

    await this.refreshContentReads();
    await this.loadImportJobDetail();
    if (this.contentReleaseId) {
      await this.loadContentReleaseActivationReadiness();
      await this.loadContentReleaseDetail();
    }
  }

  private async activateContentRelease(): Promise<void> {
    try {
      const payload = await this.request<ActivateContentReleaseResponse>(
        "Activate Content Release",
        "POST",
        resolveRoutePath(productionApiRoutes.workspace.activateContentRelease, {
          tenantKey: this.tenantKey.trim(),
          workspaceKey: this.workspaceKey.trim(),
          contentReleaseId: this.getContentReleaseId()
        }),
        {
          activatedByActorId: "frontend-angular-shell",
          forceActivation: this.forceActivation
        }
      );
      this.rememberActivity(
        "Release Activated",
        `${payload.contentRelease.contentReleaseId} is now ${payload.contentRelease.status}. Force activation: ${this.forceActivation ? "on" : "off"}.`
      );
      await this.refreshContentReads();
      await this.loadContentReleaseActivationReadiness();
      await this.loadContentReleaseDetail();
    } catch (error) {
      if (this.isApiError(error) && error.error === "active_content_release_has_open_runs") {
        const details = error.details as
          | {
              activeContentReleaseId?: string;
              openRuns?: unknown[];
            }
          | undefined;
        const openRunCount = Array.isArray(details?.openRuns) ? details.openRuns.length : 0;
        this.updateMonitorSummary(
          openRunCount === 0 ? "Blocked" : String(openRunCount),
          openRunCount === 0
            ? "The API reported an activation guard without open-run details."
            : `Activation blocked by ${openRunCount} open run(s) on release ${details?.activeContentReleaseId ?? "unknown"}.`
        );
        this.runtimeMonitorView = this.pretty(error.details, this.runtimeMonitorView);
        this.rememberActivity(
          "Activation Blocked",
          openRunCount === 0
            ? "The API reported an activation guard without open-run details."
            : `Release ${details?.activeContentReleaseId ?? "unknown"} still has ${openRunCount} open run(s).`
        );
      }
      throw error;
    }
  }

  private async participantSignIn(): Promise<void> {
    const payload = await this.request<ParticipantSignInResponse>(
      "Participant Sign In",
      "POST",
      productionApiRoutes.participant.signIn,
      {
        workspaceKey: this.workspaceKey.trim(),
        loginKey: this.loginKey.trim()
      } satisfies ParticipantSignInRequest
    );
    this.participantSessionId = payload.participantSession.participantSessionId;
    this.persistShellState();
    this.updateRuntimeSummary(
      payload.participantSession.status,
      `Session ${payload.participantSession.participantSessionId} signed in for login ${payload.participantSession.loginKey}.`
    );
    this.runtimeMonitorView = this.pretty(payload, this.runtimeMonitorView);
    this.rememberActivity(
      "Participant Signed In",
      `Session ${payload.participantSession.participantSessionId} is ready.`
    );
    await this.refreshCrossViewStateAfterRuntimeChange();
  }

  private async resumeParticipantSession(): Promise<void> {
    const payload = await this.request<ResumeParticipantSessionResponse>(
      "Resume Session",
      "POST",
      resolveRoutePath(productionApiRoutes.participant.resumeSession, {
        participantSessionId: this.getParticipantSessionId()
      })
    );
    this.syncRuntimeStateFromRun(payload.testRun);
    this.updateRuntimeSummary(
      payload.testRun.status,
      `Run ${payload.testRun.testRunId} resumed at ${payload.testRun.currentUnitKey ?? "no current unit"}.`
    );
    this.runtimeMonitorView = this.pretty(payload, this.runtimeMonitorView);
    this.rememberActivity(
      "Session Resumed",
      `Run ${payload.testRun.testRunId} is ${payload.testRun.status}.`
    );
    await this.refreshCrossViewStateAfterRuntimeChange();
  }

  private async saveProgress(status: "paused" | "running"): Promise<void> {
    const payload = await this.request<SaveTestRunProgressResponse>(
      status === "paused" ? "Save Progress Paused" : "Save Progress Running",
      "POST",
      resolveRoutePath(productionApiRoutes.participant.saveProgress, {
        testRunId: this.getTestRunId()
      }),
      {
        currentUnitKey: this.currentUnitKey.trim() || null,
        status
      } satisfies SaveTestRunProgressRequest
    );

    this.syncRuntimeStateFromRun(payload.testRun);
    this.updateRuntimeSummary(
      payload.testRun.status,
      status === "paused"
        ? `Run parked at ${payload.testRun.currentUnitKey ?? "no unit"}.`
        : `Run is active at ${payload.testRun.currentUnitKey ?? "no unit"}.`
    );
    this.runtimeMonitorView = this.pretty(payload, this.runtimeMonitorView);
    this.rememberActivity(
      "Progress Saved",
      status === "paused"
        ? `Run ${payload.testRun.testRunId} is now paused at ${payload.testRun.currentUnitKey ?? "no unit"}.`
        : `Run ${payload.testRun.testRunId} continues at ${payload.testRun.currentUnitKey ?? "no unit"}.`
    );
    await this.refreshCrossViewStateAfterRuntimeChange();
  }

  private async resumeRun(): Promise<void> {
    const payload = await this.request<ResumeTestRunResponse>(
      "Resume Run",
      "POST",
      resolveRoutePath(productionApiRoutes.participant.resumeRun, {
        testRunId: this.getTestRunId()
      })
    );
    this.syncRuntimeStateFromRun(payload.testRun);
    this.updateRuntimeSummary(
      payload.testRun.status,
      `Run resumed at ${payload.testRun.currentUnitKey ?? "no unit"}.`
    );
    this.runtimeMonitorView = this.pretty(payload, this.runtimeMonitorView);
    this.rememberActivity("Run Resumed", `Run ${payload.testRun.testRunId} is running again.`);
    await this.refreshCrossViewStateAfterRuntimeChange();
  }

  private async completeRun(): Promise<void> {
    const payload = await this.request<{ testRun: { testRunId: string; status: string; completedAt?: string | null } }>(
      "Complete Run",
      "POST",
      resolveRoutePath(productionApiRoutes.participant.completeRun, {
        testRunId: this.getTestRunId()
      })
    );
    this.syncRuntimeStateFromRun(payload.testRun);
    this.updateRuntimeSummary(
      payload.testRun.status,
      `Run ${payload.testRun.testRunId} completed at ${payload.testRun.completedAt ?? "unknown"}.`
    );
    this.runtimeMonitorView = this.pretty(payload, this.runtimeMonitorView);
    this.rememberActivity("Run Completed", `Run ${payload.testRun.testRunId} is closed.`);
    await this.refreshCrossViewStateAfterRuntimeChange();
  }

  private async refreshWorkspaceOverview(quiet = false): Promise<void> {
    const payload = await this.request<GetWorkspaceOverviewResponse>(
      "Workspace Overview",
      "GET",
      resolveRoutePath(productionApiRoutes.workspace.getWorkspaceOverview, {
        tenantKey: this.tenantKey.trim(),
        workspaceKey: this.workspaceKey.trim()
      }),
      undefined,
      { quiet }
    );
    this.workspaceOverviewView = this.pretty(payload, this.workspaceOverviewView);
    this.workspaceLoaded = true;
    const overview = payload.workspaceOverview;
    this.updateWorkspaceSummary(
      overview.workspace.displayName || overview.workspace.workspaceKey,
      `${overview.sourcePackageCount} package(s), ${overview.importJobCount} import(s), ${overview.contentReleaseCount} release(s), ${overview.openTestRunCount} open run(s)`
    );
    if (!quiet) {
      this.rememberActivity(
        "Workspace Refreshed",
        `${overview.workspace.workspaceKey} now shows ${overview.openTestRunCount} open run(s) and ${overview.contentReleaseCount} release(s).`
      );
    }
  }

  private async refreshContentReads(quiet = false): Promise<void> {
    const tenantKey = this.tenantKey.trim();
    const workspaceKey = this.workspaceKey.trim();
    const [workspaceActivity, sourcePackages, importJobs, participantSessions, contentReleases] =
      await Promise.all([
        this.request<ListWorkspaceActivityEventsResponse>(
          "Workspace Activity",
          "GET",
          resolveRoutePath(productionApiRoutes.workspace.listWorkspaceActivityEvents, {
            tenantKey,
            workspaceKey
          }),
          undefined,
          { quiet }
        ),
        this.request<ListSourcePackagesResponse>(
          "Source Packages",
          "GET",
          resolveRoutePath(productionApiRoutes.workspace.listSourcePackages, {
            tenantKey,
            workspaceKey
          }),
          undefined,
          { quiet }
        ),
        this.request<ListImportJobsResponse>(
          "Import Jobs",
          "GET",
          resolveRoutePath(productionApiRoutes.workspace.listImportJobs, {
            tenantKey,
            workspaceKey
          }),
          undefined,
          { quiet }
        ),
        this.request<ListParticipantSessionsResponse>(
          "Participant Sessions",
          "GET",
          resolveRoutePath(productionApiRoutes.workspace.listParticipantSessions, {
            tenantKey,
            workspaceKey
          }),
          undefined,
          { quiet }
        ),
        this.request<ListContentReleasesResponse>(
          "Content Releases",
          "GET",
          resolveRoutePath(productionApiRoutes.workspace.listContentReleases, {
            tenantKey,
            workspaceKey
          }),
          undefined,
          { quiet }
        )
      ]);

    this.workspaceActivityView = this.pretty(workspaceActivity, this.workspaceActivityView);
    this.sourcePackagesView = this.pretty(sourcePackages, this.sourcePackagesView);
    this.importJobsView = this.pretty(importJobs, this.importJobsView);
    this.participantSessionsView = this.pretty(
      participantSessions,
      this.participantSessionsView
    );
    this.contentReleasesView = this.pretty(contentReleases, this.contentReleasesView);
    this.contentLoaded = true;

    const latestImport = importJobs.items[0]?.importJob;
    const latestRelease = contentReleases.items[0]?.contentRelease;
    const failedImportCount = importJobs.items.filter(
      item => item.importJob.status === "failed"
    ).length;
    this.updateContentSummary(
      latestRelease?.status ?? latestImport?.status ?? "empty",
      `${sourcePackages.items.length} package(s), ${importJobs.items.length} import(s), ${participantSessions.items.length} session(s), ${contentReleases.items.length} release(s), ${failedImportCount} failed import(s)`
    );

    this.sourcePackageId =
      sourcePackages.items[0]?.sourcePackage.sourcePackageId ?? this.sourcePackageId;
    this.importJobId = importJobs.items[0]?.importJob.importJobId ?? this.importJobId;
    this.contentReleaseId =
      contentReleases.items[0]?.contentRelease.contentReleaseId ?? this.contentReleaseId;
    this.persistShellState();

    const latestActivity = workspaceActivity.items[0]?.activityEvent;
    if (latestActivity) {
      this.rememberActivity("Workspace Activity", latestActivity.summary);
    } else if (!quiet) {
      this.rememberActivity(
        "Content Refreshed",
        `Loaded ${contentReleases.items.length} release(s) and ${importJobs.items.length} import job(s).`
      );
    }
  }

  private async refreshRuntimeReads(quiet = false): Promise<void> {
    const tenantKey = this.tenantKey.trim();
    const workspaceKey = this.workspaceKey.trim();
    const sessionId = this.participantSessionId.trim();

    const openRuns = await this.request<MonitorOpenRunsResponse>(
      "Monitor Open Runs",
      "GET",
      resolveRoutePath(productionApiRoutes.monitor.openRuns, {
        tenantKey,
        workspaceKey
      }),
      undefined,
      { quiet }
    );
    this.openRunsView = this.pretty(openRuns, this.openRunsView);
    const openRunCount = openRuns.items.length;
    this.updateMonitorSummary(
      openRunCount === 0 ? "Clear" : String(openRunCount),
      openRunCount === 0
        ? "No open runs are blocking activation."
        : `${openRunCount} open run(s) could block a new activation.`
    );

    if (!sessionId) {
      this.runtimeStateView = this.pretty(
        {
          status: "participant_session_required",
          message: "Sign in a participant or enter a session id to hydrate runtime reads."
        },
        this.runtimeStateView
      );
      this.currentRunStateView = this.pretty(
        {
          status: "participant_session_required",
          message: "Current run state appears after a participant session is available."
        },
        this.currentRunStateView
      );
      this.runtimeLoaded = true;
      if (!quiet) {
        this.rememberActivity(
          "Runtime Refresh",
          openRunCount === 0
            ? "Monitor is clear; sign in a participant to load runtime state."
            : `Monitor sees ${openRunCount} open run(s); sign in a participant to inspect session state.`
        );
      }
      return;
    }

    const [runtimeStatePayload, currentRunStatePayload, sessionDetailPayload] =
      await Promise.all([
        this.request<ParticipantRuntimeStateResponse>(
          "Runtime State",
          "GET",
          resolveRoutePath(productionApiRoutes.participant.getRuntimeState, {
            participantSessionId: sessionId
          }),
          undefined,
          { quiet }
        ),
        this.request<ParticipantCurrentRunStateResponse>(
          "Current State",
          "GET",
          resolveRoutePath(productionApiRoutes.participant.getCurrentRunState, {
            participantSessionId: sessionId
          }),
          undefined,
          { quiet }
        ),
        this.request<GetParticipantSessionResponse>(
          "Participant Session Detail",
          "GET",
          resolveRoutePath(productionApiRoutes.workspace.getParticipantSession, {
            tenantKey,
            workspaceKey,
            participantSessionId: sessionId
          }),
          undefined,
          { quiet }
        )
      ]);

    this.runtimeStateView = this.pretty(runtimeStatePayload, this.runtimeStateView);
    this.currentRunStateView = this.pretty(currentRunStatePayload, this.currentRunStateView);
    this.participantSessionDetailView = this.pretty(
      sessionDetailPayload,
      this.participantSessionDetailView
    );
    this.runtimeMonitorView = this.pretty(
      {
        runtimeState: runtimeStatePayload.runtimeState,
        currentRunState: currentRunStatePayload.currentRunState,
        openRuns
      },
      this.runtimeMonitorView
    );

    this.runtimeLoaded = true;
    this.syncRuntimeStateFromRun(runtimeStatePayload.runtimeState.latestTestRun);
    this.updateRuntimeSummary(
      runtimeStatePayload.runtimeState.availableAction ??
        runtimeStatePayload.runtimeState.runtimeStatus,
      currentRunStatePayload.currentRunState.currentUnit
        ? `Current unit: ${currentRunStatePayload.currentRunState.currentUnit.displayLabel}.`
        : runtimeStatePayload.runtimeState.latestTestRun
          ? `Run ${runtimeStatePayload.runtimeState.latestTestRun.testRunId} is ${runtimeStatePayload.runtimeState.latestTestRun.status}.`
          : `Session is ${runtimeStatePayload.runtimeState.runtimeStatus}.`
    );

    if (!quiet) {
      this.rememberActivity(
        "Runtime Refresh",
        currentRunStatePayload.currentRunState.currentUnit
          ? `Session ${sessionId} is ${runtimeStatePayload.runtimeState.runtimeStatus} at ${currentRunStatePayload.currentRunState.currentUnit.displayLabel}.`
          : `Session ${sessionId} is ${runtimeStatePayload.runtimeState.runtimeStatus}.`
      );
    }
  }

  private async refreshOperationalDiagnostics(quiet = false): Promise<void> {
    const [health, readiness, manifest, metrics, runtimeDiagnostics, runtimeConfig] =
      await Promise.all([
        this.requestJson("Health", "/healthz", quiet),
        this.requestJson("Readiness", "/readyz", quiet),
        this.requestJson("Manifest", "/manifest", quiet),
        this.requestJson("Metrics", "/metrics", quiet),
        this.requestJson<GetRuntimeDiagnosticsResponse>(
          "Runtime Diagnostics",
          productionApiRoutes.system.getRuntimeDiagnostics,
          quiet
        ),
        this.requestJson<GetRuntimeConfigResponse>(
          "Runtime Config",
          productionApiRoutes.system.getRuntimeConfig,
          quiet
        )
      ]);

    this.runtimeHealthView = this.pretty(
      {
        health,
        readiness,
        manifest
      },
      this.runtimeHealthView
    );
    this.runtimeMetricsView = this.pretty(metrics, this.runtimeMetricsView);
    this.runtimeDiagnosticsView = this.pretty(
      runtimeDiagnostics,
      this.runtimeDiagnosticsView
    );
    this.runtimeConfigView = this.pretty(runtimeConfig, this.runtimeConfigView);
    this.storageKind = this.readString(manifest, ["storage", "kind"]) ?? this.storageKind;
    this.storageSchemaVersion =
      this.readScalar(manifest, ["storage", "schemaVersion"]) ?? this.storageSchemaVersion;
    this.readinessBadge = this.readString(readiness, ["status"]) ?? this.readinessBadge;
    this.diagnosticsLoaded = true;

    if (!quiet) {
      this.rememberActivity(
        "Diagnostics Refreshed",
        `Runtime is ${this.readinessBadge} on storage ${this.storageKind}.`
      );
    }
  }

  private async refreshMetricsOnly(): Promise<void> {
    const metrics = await this.requestJson("Metrics", "/metrics");
    this.runtimeMetricsView = this.pretty(metrics, this.runtimeMetricsView);
    const completedRequests =
      this.readNumber(metrics, ["runtime", "completedRequests"]) ?? 0;
    this.rememberActivity(
      "Metrics Refreshed",
      `Process has served ${completedRequests} completed request(s).`
    );
  }

  private async loadSourcePackageDetail(): Promise<GetSourcePackageResponse> {
    const payload = await this.request<GetSourcePackageResponse>(
      "Source Package Detail",
      "GET",
      resolveRoutePath(productionApiRoutes.workspace.getSourcePackage, {
        tenantKey: this.tenantKey.trim(),
        workspaceKey: this.workspaceKey.trim(),
        sourcePackageId: this.getSourcePackageId()
      })
    );
    this.sourcePackageDetailView = this.pretty(payload, this.sourcePackageDetailView);
    const sourcePackage = payload.sourcePackageDetail.sourcePackage;
    this.rememberActivity(
      "Source Package Detail",
      `${sourcePackage.fileName} is currently ${sourcePackage.status}.`
    );
    return payload;
  }

  private async loadImportJobDetail(): Promise<GetImportJobResponse> {
    const payload = await this.request<GetImportJobResponse>(
      "Import Job Detail",
      "GET",
      resolveRoutePath(productionApiRoutes.workspace.getImportJob, {
        tenantKey: this.tenantKey.trim(),
        workspaceKey: this.workspaceKey.trim(),
        importJobId: this.getImportJobId()
      })
    );
    this.importJobDetailView = this.pretty(payload, this.importJobDetailView);
    const importJob = payload.importJobDetail.importJob;
    const firstDiagnostic = importJob.diagnostics[0]?.code;
    this.rememberActivity(
      "Import Job Detail",
      `Import ${importJob.importJobId} is ${importJob.status}.${firstDiagnostic ? ` First diagnostic: ${firstDiagnostic}.` : ""}`
    );
    this.importJobId = importJob.importJobId;
    this.contentReleaseId =
      payload.importJobDetail.contentRelease?.contentReleaseId ?? this.contentReleaseId;
    this.persistShellState();
    return payload;
  }

  private async loadParticipantSessionDetail(): Promise<GetParticipantSessionResponse> {
    const payload = await this.request<GetParticipantSessionResponse>(
      "Participant Session Detail",
      "GET",
      resolveRoutePath(productionApiRoutes.workspace.getParticipantSession, {
        tenantKey: this.tenantKey.trim(),
        workspaceKey: this.workspaceKey.trim(),
        participantSessionId: this.getParticipantSessionId()
      })
    );
    this.participantSessionDetailView = this.pretty(
      payload,
      this.participantSessionDetailView
    );
    const participantSession = payload.participantSessionDetail.participantSession;
    this.rememberActivity(
      "Participant Session Detail",
      `Session ${participantSession.participantSessionId} is ${participantSession.status}.`
    );
    return payload;
  }

  private async loadContentReleaseActivationReadiness(): Promise<GetContentReleaseActivationReadinessResponse> {
    const payload = await this.request<GetContentReleaseActivationReadinessResponse>(
      "Content Release Activation Readiness",
      "GET",
      resolveRoutePath(
        productionApiRoutes.workspace.getContentReleaseActivationReadiness,
        {
          tenantKey: this.tenantKey.trim(),
          workspaceKey: this.workspaceKey.trim(),
          contentReleaseId: this.getContentReleaseId()
        }
      )
    );
    this.contentReleaseActivationReadinessView = this.pretty(
      payload,
      this.contentReleaseActivationReadinessView
    );
    const activationReadiness = payload.activationReadiness;
    this.updateMonitorSummary(
      activationReadiness.canActivate
        ? "Ready"
        : String(activationReadiness.blockingOpenRuns.length),
      activationReadiness.canActivate
        ? "The selected release can be activated without forcing."
        : `The selected release is blocked by ${activationReadiness.blockingOpenRuns.length} open run(s).`
    );
    this.rememberActivity(
      "Release Readiness",
      activationReadiness.canActivate
        ? `Release ${activationReadiness.contentRelease.contentReleaseId} can activate now.`
        : `Release ${activationReadiness.contentRelease.contentReleaseId} is blocked by ${activationReadiness.blockingOpenRuns.length} open run(s).`
    );
    return payload;
  }

  private async loadContentReleaseDetail(): Promise<GetContentReleaseResponse> {
    const payload = await this.request<GetContentReleaseResponse>(
      "Content Release Detail",
      "GET",
      resolveRoutePath(productionApiRoutes.workspace.getContentRelease, {
        tenantKey: this.tenantKey.trim(),
        workspaceKey: this.workspaceKey.trim(),
        contentReleaseId: this.getContentReleaseId()
      })
    );
    this.contentReleaseDetailView = this.pretty(payload, this.contentReleaseDetailView);
    const release = payload.contentReleaseDetail.contentRelease;
    this.rememberActivity(
      "Release Detail",
      `Release ${release.contentReleaseId} is currently ${release.status}.`
    );
    return payload;
  }

  private async retrySourcePackageImport(): Promise<void> {
    const payload = await this.request<RetrySourcePackageImportResponse>(
      "Retry Source Package Import",
      "POST",
      resolveRoutePath(productionApiRoutes.workspace.retrySourcePackageImport, {
        tenantKey: this.tenantKey.trim(),
        workspaceKey: this.workspaceKey.trim(),
        sourcePackageId: this.getSourcePackageId()
      }),
      {
        fileName: this.sourceFileName.trim(),
        mediaType: this.sourceMediaType.trim(),
        sourceDocument: this.sourceDocument
      } satisfies RetrySourcePackageImportRequest
    );
    this.importJobId = payload.importJob?.importJobId ?? this.importJobId;
    this.contentReleaseId =
      payload.stagedContentRelease?.contentReleaseId ?? this.contentReleaseId;
    this.sourcePackageDetailView = this.pretty(payload, this.sourcePackageDetailView);
    this.persistShellState();
    this.rememberActivity(
      "Import Retried",
      `Package ${this.getSourcePackageId()} produced import ${payload.importJob?.importJobId ?? "n/a"} with status ${payload.importJob?.status ?? "unknown"}.`
    );
    await this.refreshContentReads();
    await this.loadImportJobDetail();
    if (this.contentReleaseId) {
      await this.loadContentReleaseDetail();
    }
  }

  private async bootstrapWorkspaceFlow(): Promise<void> {
    await this.allowConflict(() => this.createTenant(), ["tenant_key_conflict"]);
    await this.allowConflict(() => this.createWorkspace(), ["workspace_key_conflict"]);
    await this.refreshWorkspaceOverview();
    this.rememberActivity(
      "Guided Flow",
      `Workspace bootstrap completed for ${this.workspaceKey.trim()}.`
    );
  }

  private async importActivateFlow(): Promise<void> {
    await this.createSourcePackage();
    await this.createImportJob();
    if (this.contentReleaseId) {
      await this.activateContentRelease();
    }
    this.rememberActivity(
      "Guided Flow",
      this.contentReleaseId
        ? `Import and activation finished for release ${this.contentReleaseId}.`
        : "Import finished without a staged release."
    );
  }

  private async participantHappyPathFlow(): Promise<void> {
    await this.participantSignIn();
    await this.resumeParticipantSession();
    await this.refreshRuntimeReads();
    this.rememberActivity(
      "Guided Flow",
      `Participant happy path completed for session ${this.getParticipantSessionId()}.`
    );
  }

  private async refreshCrossViewStateAfterRuntimeChange(): Promise<void> {
    await Promise.all([
      this.refreshWorkspaceOverview(true),
      this.refreshContentReads(true),
      this.refreshRuntimeReads(true)
    ]);
  }

  private syncRuntimeStateFromRun(
    testRun:
      | {
          testRunId: string;
          currentUnitKey?: string | null;
        }
      | null
      | undefined
  ): void {
    if (!testRun) {
      return;
    }

    this.testRunId = testRun.testRunId || this.testRunId;
    if (testRun.currentUnitKey) {
      this.currentUnitKey = testRun.currentUnitKey;
    }
    this.persistShellState();
  }

  private updateWorkspaceSummary(headline: string, detail: string): void {
    this.summaryCards = this.summaryCards.map(card =>
      card.label === "Workspace" ? { ...card, headline, detail } : card
    );
  }

  private updateContentSummary(headline: string, detail: string): void {
    this.summaryCards = this.summaryCards.map(card =>
      card.label === "Content" ? { ...card, headline, detail } : card
    );
  }

  private updateRuntimeSummary(headline: string, detail: string): void {
    this.summaryCards = this.summaryCards.map(card =>
      card.label === "Runtime" ? { ...card, headline, detail } : card
    );
  }

  private updateMonitorSummary(headline: string, detail: string): void {
    this.summaryCards = this.summaryCards.map(card =>
      card.label === "Monitor" ? { ...card, headline, detail } : card
    );
  }

  private rememberActivity(title: string, detail: string): void {
    this.activityFeed = [{ title, detail }, ...this.activityFeed].slice(0, 8);
  }

  private getSourcePackageId(): string {
    return this.sourcePackageId.trim();
  }

  private getImportJobId(): string {
    return this.importJobId.trim();
  }

  private getContentReleaseId(): string {
    return this.contentReleaseId.trim();
  }

  private getParticipantSessionId(): string {
    return this.participantSessionId.trim();
  }

  private getTestRunId(): string {
    return this.testRunId.trim();
  }

  private async requestJson<T = Record<string, unknown>>(
    label: string,
    path: string,
    quiet = false
  ): Promise<T> {
    return this.request<T>(label, "GET", path, undefined, { quiet });
  }

  private async request<T>(
    label: string,
    method: string,
    path: string,
    body?: unknown,
    options: { quiet?: boolean } = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json"
    };
    const init: RequestInit = {
      method,
      headers
    };

    if (body !== undefined && method !== "GET" && method !== "HEAD") {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    if (!options.quiet) {
      this.foregroundRequestDepth += 1;
      this.activeRequestLabel = label;
      this.errorMessage = null;
    }

    try {
      const response = await fetch(path, init);
      const contentType = response.headers.get("content-type") ?? "";
      let payload: unknown = null;

      if (response.status !== 204) {
        payload = contentType.includes("application/json")
          ? await response.json()
          : await response.text();
      }

      if (!options.quiet) {
        this.responseMeta = `${label} · ${response.status}`;
        this.lastResponse = this.pretty(payload, `HTTP ${response.status}`);
      }

      if (!response.ok) {
        const error = this.normalizeApiError(response.status, payload);
        if (!options.quiet) {
          this.errorMessage = error.message;
        }
        throw error;
      }

      return payload as T;
    } finally {
      if (!options.quiet) {
        this.foregroundRequestDepth = Math.max(0, this.foregroundRequestDepth - 1);
        if (this.foregroundRequestDepth === 0) {
          this.activeRequestLabel = null;
        }
      }
    }
  }

  private normalizeApiError(statusCode: number, payload: unknown): ApiErrorLike {
    if (payload && typeof payload === "object" && "error" in payload) {
      return {
        ...(payload as ApiErrorResponse),
        statusCode
      };
    }

    return {
      error: "unexpected_error",
      message: typeof payload === "string" ? payload : `HTTP ${statusCode}`,
      statusCode,
      details: payload
    };
  }

  private isApiError(value: unknown): value is ApiErrorLike {
    return value != null && typeof value === "object" && "error" in value;
  }

  private async allowConflict<T>(
    operation: () => Promise<T>,
    allowedErrorCodes: string[]
  ): Promise<T | undefined> {
    try {
      return await operation();
    } catch (error) {
      if (this.isApiError(error) && allowedErrorCodes.includes(error.error)) {
        this.rememberActivity(
          "Guided Flow",
          `${error.message} Continuing with the existing resource.`
        );
        return undefined;
      }
      throw error;
    }
  }

  private pretty(value: unknown, fallback: string): string {
    if (value == null) {
      return fallback;
    }

    if (typeof value === "string") {
      return value;
    }

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return fallback;
    }
  }

  private readString(
    value: unknown,
    path: string[]
  ): string | null {
    const scalar = this.readUnknown(value, path);
    return typeof scalar === "string" ? scalar : null;
  }

  private readNumber(
    value: unknown,
    path: string[]
  ): number | null {
    const scalar = this.readUnknown(value, path);
    return typeof scalar === "number" ? scalar : null;
  }

  private readScalar(value: unknown, path: string[]): string | null {
    const scalar = this.readUnknown(value, path);
    if (scalar == null) {
      return null;
    }
    return typeof scalar === "string" || typeof scalar === "number"
      ? String(scalar)
      : null;
  }

  private readUnknown(value: unknown, path: string[]): unknown {
    let current: unknown = value;
    for (const segment of path) {
      if (!current || typeof current !== "object" || !(segment in current)) {
        return null;
      }
      current = (current as Record<string, unknown>)[segment];
    }
    return current;
  }
}
