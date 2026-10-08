import { Injectable, Injector, inject } from "@angular/core";

import type { MonitorEventStreamService } from "./monitor-event-stream.service";
import { RewriteAppShellLifecycleService } from "./rewrite-app-shell-lifecycle.service";
import type { AppView } from "./rewrite-app-shell.types";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

@Injectable({ providedIn: "root" })
export class RewriteAppViewStateService {
  private readonly uiState = inject(RewriteAppUiStateService);
  private readonly injector = inject(Injector);
  private readonly lifecycle = inject(RewriteAppShellLifecycleService);
  private monitorEvents: MonitorEventStreamService | null = null;
  private initialized = false;

  private readonly workspaceState = this.uiState.workspace;
  private readonly refreshWorkspaceOverview = async (quiet?: boolean) => {
    const { RewriteAppWorkspaceService } = await import(
      "./rewrite-app-workspace.service"
    );
    return this.injector
      .get(RewriteAppWorkspaceService)
      .refreshWorkspaceOverview(quiet);
  };
  private readonly refreshContentReads = async (quiet?: boolean) => {
    const { RewriteAppContentService } = await import(
      "./rewrite-app-content.service"
    );
    return this.injector.get(RewriteAppContentService).refreshContentReads(quiet);
  };
  private readonly refreshRuntimeReads = async (quiet?: boolean) => {
    const { RewriteAppRuntimeService } = await import(
      "./rewrite-app-runtime.service"
    );
    return this.injector.get(RewriteAppRuntimeService).refreshRuntimeReads(quiet);
  };
  private readonly refreshOperationalDiagnostics = async (quiet?: boolean) => {
    const { RewriteAppOpsService } = await import("./rewrite-app-ops.service");
    return this.injector
      .get(RewriteAppOpsService)
      .refreshOperationalDiagnostics(quiet);
  };

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
    this.onActionAsync(() => this.refreshOperationalDiagnostics(true));
  }

  destroy(): void {
    if (!this.initialized) {
      return;
    }
    this.initialized = false;
    this.monitorEvents?.stop("Application shell closed.");
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
    void this.getMonitorEvents().then(monitorEvents => {
      if (this.initialized && this.activeView === "runtime") {
        monitorEvents.restart(() => this.refreshRuntimeReads(true));
      }
    });
  }

  onActionAsync(action: () => Promise<unknown>): void {
    void this.runActionAsync(action);
  }

  runActionAsync(action: () => Promise<unknown>): Promise<void> {
    return action()
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => {
        this.uiState.renderVersion.update(version => version + 1);
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
      void this.getMonitorEvents().then(monitorEvents => {
        if (this.initialized && this.activeView === "runtime") {
          monitorEvents.start(() => this.refreshRuntimeReads(true));
        }
      });
      return;
    }
    this.monitorEvents?.stop();
  }

  private async getMonitorEvents(): Promise<MonitorEventStreamService> {
    if (this.monitorEvents) {
      return this.monitorEvents;
    }
    const { MonitorEventStreamService } = await import(
      "./monitor-event-stream.service"
    );
    this.monitorEvents = this.injector.get(MonitorEventStreamService);
    return this.monitorEvents;
  }
}
