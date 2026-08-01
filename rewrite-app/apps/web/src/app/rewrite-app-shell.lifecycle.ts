import type { AppView } from "./rewrite-app-shell.types";

export interface ShellLifecycleHost {
  activeView: AppView;
  workspaceLoaded: boolean;
  contentLoaded: boolean;
  runtimeLoaded: boolean;
  diagnosticsLoaded: boolean;
  autoRefreshEnabled: boolean;
  autoRefreshSeconds: number;
  autoRefreshHandle: number | null;
  refreshWorkspaceOverview(quiet?: boolean): Promise<void>;
  refreshContentReads(quiet?: boolean): Promise<void>;
  refreshRuntimeReads(quiet?: boolean): Promise<void>;
  refreshOperationalDiagnostics(quiet?: boolean): Promise<void>;
}

export async function ensureShellDataForView(
  host: ShellLifecycleHost,
  view: AppView
): Promise<void> {
  if (view === "workspace" && !host.workspaceLoaded) {
    await host.refreshWorkspaceOverview(true).catch(() => undefined);
    return;
  }
  if (view === "content" && !host.contentLoaded) {
    await host.refreshContentReads(true).catch(() => undefined);
    return;
  }
  if (view === "runtime" && !host.runtimeLoaded) {
    await host.refreshRuntimeReads(true).catch(() => undefined);
    return;
  }
  if (view === "participant" || view === "system-check") {
    return;
  }
  if (view === "ops" && !host.diagnosticsLoaded) {
    await host.refreshOperationalDiagnostics(true).catch(() => undefined);
  }
}

export function clearShellAutoRefresh(host: ShellLifecycleHost): void {
  if (host.autoRefreshHandle != null) {
    window.clearInterval(host.autoRefreshHandle);
    host.autoRefreshHandle = null;
  }
}

export function scheduleShellAutoRefresh(host: ShellLifecycleHost): void {
  clearShellAutoRefresh(host);

  if (!host.autoRefreshEnabled) {
    return;
  }

  const refreshSeconds = Math.max(3, Number(host.autoRefreshSeconds) || 8);
  host.autoRefreshHandle = window.setInterval(() => {
    void refreshShellActiveViewData(host);
  }, refreshSeconds * 1000);
}

export async function refreshShellActiveViewData(
  host: ShellLifecycleHost
): Promise<void> {
  try {
    if (host.activeView === "workspace") {
      await host.refreshWorkspaceOverview(true);
      return;
    }
    if (host.activeView === "content") {
      await host.refreshContentReads(true);
      return;
    }
    if (host.activeView === "runtime") {
      await host.refreshRuntimeReads(true);
      return;
    }
    if (
      host.activeView === "participant" ||
      host.activeView === "system-check"
    ) {
      return;
    }
    await host.refreshOperationalDiagnostics(true);
  } catch {
    // Keep background refresh best-effort only.
  }
}
