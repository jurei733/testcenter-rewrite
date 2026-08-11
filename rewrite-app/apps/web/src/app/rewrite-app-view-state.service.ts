import { ApplicationRef, Injectable, inject } from "@angular/core";

import { RewriteAppContentService } from "./rewrite-app-content.service";
import { MonitorEventStreamService } from "./monitor-event-stream.service";
import { RewriteAppOpsService } from "./rewrite-app-ops.service";
import { RewriteAppRuntimeService } from "./rewrite-app-runtime.service";
import { RewriteAppShellLifecycleService } from "./rewrite-app-shell-lifecycle.service";
import type { AppView } from "./rewrite-app-shell.types";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";
import { RewriteAppWorkspaceService } from "./rewrite-app-workspace.service";

@Injectable({ providedIn: "root" })
export class RewriteAppViewStateService {
  private readonly uiState = inject(RewriteAppUiStateService);
  private readonly applicationRef = inject(ApplicationRef);
  private readonly lifecycle = inject(RewriteAppShellLifecycleService);
  private readonly monitorEvents = inject(MonitorEventStreamService);
  private readonly workspaceService = inject(RewriteAppWorkspaceService);
  private readonly contentService = inject(RewriteAppContentService);
  private readonly runtimeService = inject(RewriteAppRuntimeService);
  private readonly opsService = inject(RewriteAppOpsService);
  private initialized = false;

  private readonly workspaceState = this.uiState.workspace;
  private readonly refreshWorkspaceOverview = (quiet?: boolean) =>
    this.workspaceService.refreshWorkspaceOverview(quiet);
  private readonly refreshContentReads = (quiet?: boolean) =>
    this.contentService.refreshContentReads(quiet);
  private readonly refreshRuntimeReads = (quiet?: boolean) =>
    this.runtimeService.refreshRuntimeReads(quiet);
  private readonly refreshOperationalDiagnostics = (quiet?: boolean) =>
    this.opsService.refreshOperationalDiagnostics(quiet);

  get activeView(): AppView {
    return this.uiState.activeView;
  }

  private set activeView(nextValue: AppView) {
    this.uiState.activeView = nextValue;
  }

  init(initialView: AppView | null = null): void {
    if (this.initialized) {
      if (initialView) {
        this.setActiveView(initialView);
      }
      return;
    }
    this.initialized = true;
    if (initialView) {
      this.activeView = initialView;
      this.persistShellState();
    }
    this.lifecycle.scheduleAutoRefresh(
      this.refreshWorkspaceOverview,
      this.refreshContentReads,
      this.refreshRuntimeReads,
      this.refreshOperationalDiagnostics
    );
    this.syncMonitorEventStream();
    void this.opsService.refreshOperationalDiagnostics(true);
  }

  destroy(): void {
    if (!this.initialized) {
      return;
    }
    this.initialized = false;
    this.monitorEvents.stop("Application shell closed.");
    this.lifecycle.clearAutoRefresh(
      this.refreshWorkspaceOverview,
      this.refreshContentReads,
      this.refreshRuntimeReads,
      this.refreshOperationalDiagnostics
    );
  }

  setActiveView(view: AppView): void {
    if (!this.initialized) {
      this.init(view);
      return;
    }
    if (this.activeView === view) {
      this.syncMonitorEventStream();
      void this.lifecycle.ensureDataForView(
        view,
        this.refreshWorkspaceOverview,
        this.refreshContentReads,
        this.refreshRuntimeReads,
        this.refreshOperationalDiagnostics
      );
      return;
    }

    this.activeView = view;
    this.syncMonitorEventStream();
    this.persistShellState();
    void this.lifecycle.ensureDataForView(
      view,
      this.refreshWorkspaceOverview,
      this.refreshContentReads,
      this.refreshRuntimeReads,
      this.refreshOperationalDiagnostics
    );
  }

  onAutoRefreshSettingsChanged(): void {
    this.workspaceState.autoRefreshSeconds = Math.max(
      3,
      Number(this.workspaceState.autoRefreshSeconds) || 8
    );
    this.persistShellState();
    this.lifecycle.scheduleAutoRefresh(
      this.refreshWorkspaceOverview,
      this.refreshContentReads,
      this.refreshRuntimeReads,
      this.refreshOperationalDiagnostics
    );
  }

  reconnectMonitorEventStream(): void {
    if (this.activeView !== "runtime") {
      return;
    }
    this.monitorEvents.restart(() => this.runtimeService.refreshRuntimeReads(true));
  }

  onActionAsync(action: () => Promise<unknown>): void {
    void action()
      .catch(() => undefined)
      .finally(() => {
        this.uiState.renderVersion.update(version => version + 1);
        this.applicationRef.tick();
      });
  }

  persistShellState(): void {
    this.lifecycle.persistShellState();
  }

  getPersistedView(): AppView {
    return this.activeView;
  }

  private syncMonitorEventStream(): void {
    if (this.activeView === "runtime") {
      this.monitorEvents.start(() => this.runtimeService.refreshRuntimeReads(true));
      return;
    }
    this.monitorEvents.stop();
  }
}
