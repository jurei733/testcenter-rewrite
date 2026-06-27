import type {
  ShellContentState,
  ShellRuntimeState,
  ShellWorkspaceState
} from "./rewrite-app-shell.state";
import type { RuntimePresentationHost } from "./rewrite-app-shell.runtime";
import type { WorkspaceContentPresentationHost } from "./rewrite-app-shell.content";

export function createRuntimePresentationStateHost(args: {
  request<T>(
    label: string,
    method: string,
    path: string,
    body?: unknown,
    options?: { quiet?: boolean }
  ): Promise<T>;
  workspaceState: ShellWorkspaceState;
  runtimeState: ShellRuntimeState;
  persistShellState(): void;
  updateRuntimeSummary(headline: string, detail: string): void;
  updateMonitorSummary(headline: string, detail: string): void;
  rememberActivity(title: string, detail: string): void;
}): RuntimePresentationHost {
  return {
    request: args.request,
    getTenantKey: () => args.workspaceState.tenantKey.trim(),
    getWorkspaceKey: () => args.workspaceState.workspaceKey.trim(),
    getParticipantSessionId: () => args.runtimeState.participantSessionId,
    setParticipantSessionId: nextValue => {
      args.runtimeState.participantSessionId = nextValue;
      args.persistShellState();
    },
    setGroupKey: nextValue => {
      args.runtimeState.groupKey = nextValue;
      args.persistShellState();
    },
    syncRuntimeStateFromRun: testRun => {
      if (!testRun) {
        return;
      }
      args.runtimeState.testRunId = testRun.testRunId || args.runtimeState.testRunId;
      if (testRun.currentUnitKey) {
        args.runtimeState.currentUnitKey = testRun.currentUnitKey;
        args.runtimeState.currentUnitResponse =
          testRun.unitResponses?.[testRun.currentUnitKey] ?? "";
      }
      args.persistShellState();
    },
    getOpenRunsView: () => args.runtimeState.openRunsView,
    setOpenRunsView: nextValue => {
      args.runtimeState.openRunsView = nextValue;
    },
    getRuntimeStateView: () => args.runtimeState.runtimeStateView,
    setRuntimeStateView: nextValue => {
      args.runtimeState.runtimeStateView = nextValue;
    },
    getCurrentRunStateView: () => args.runtimeState.currentRunStateView,
    setCurrentRunStateView: nextValue => {
      args.runtimeState.currentRunStateView = nextValue;
    },
    getParticipantSessionDetailView: () => args.runtimeState.participantSessionDetailView,
    setParticipantSessionDetailView: nextValue => {
      args.runtimeState.participantSessionDetailView = nextValue;
    },
    getRuntimeMonitorView: () => args.runtimeState.runtimeMonitorView,
    setRuntimeMonitorView: nextValue => {
      args.runtimeState.runtimeMonitorView = nextValue;
    },
    setRuntimeLoaded: nextValue => {
      args.runtimeState.runtimeLoaded = nextValue;
    },
    updateRuntimeSummary: args.updateRuntimeSummary,
    updateMonitorSummary: args.updateMonitorSummary,
    rememberActivity: args.rememberActivity
  };
}

export function createWorkspaceContentPresentationStateHost(args: {
  workspaceState: ShellWorkspaceState;
  contentState: ShellContentState;
  runtimeState: ShellRuntimeState;
  persistShellState(): void;
  updateWorkspaceSummary(headline: string, detail: string): void;
  updateContentSummary(headline: string, detail: string): void;
  rememberActivity(title: string, detail: string): void;
}): WorkspaceContentPresentationHost {
  return {
    getWorkspaceOverviewView: () => args.workspaceState.workspaceOverviewView,
    setWorkspaceOverviewView: nextValue => {
      args.workspaceState.workspaceOverviewView = nextValue;
    },
    setWorkspaceLoaded: nextValue => {
      args.workspaceState.workspaceLoaded = nextValue;
    },
    updateWorkspaceSummary: args.updateWorkspaceSummary,
    rememberActivity: args.rememberActivity,
    getWorkspaceActivityView: () => args.workspaceState.workspaceActivityView,
    setWorkspaceActivityView: nextValue => {
      args.workspaceState.workspaceActivityView = nextValue;
    },
    getSourcePackagesView: () => args.contentState.sourcePackagesView,
    setSourcePackagesView: nextValue => {
      args.contentState.sourcePackagesView = nextValue;
    },
    getImportJobsView: () => args.contentState.importJobsView,
    setImportJobsView: nextValue => {
      args.contentState.importJobsView = nextValue;
    },
    getParticipantSessionsView: () => args.runtimeState.participantSessionsView,
    setParticipantSessionsView: nextValue => {
      args.runtimeState.participantSessionsView = nextValue;
    },
    getContentReleasesView: () => args.contentState.contentReleasesView,
    setContentReleasesView: nextValue => {
      args.contentState.contentReleasesView = nextValue;
    },
    setContentLoaded: nextValue => {
      args.contentState.contentLoaded = nextValue;
    },
    updateContentSummary: args.updateContentSummary,
    getSourcePackageId: () => args.contentState.sourcePackageId,
    setSourcePackageId: nextValue => {
      args.contentState.sourcePackageId = nextValue;
      args.persistShellState();
    },
    getImportJobId: () => args.contentState.importJobId,
    setImportJobId: nextValue => {
      args.contentState.importJobId = nextValue;
      args.persistShellState();
    },
    getContentReleaseId: () => args.contentState.contentReleaseId,
    setContentReleaseId: nextValue => {
      args.contentState.contentReleaseId = nextValue;
      args.persistShellState();
    }
  };
}
