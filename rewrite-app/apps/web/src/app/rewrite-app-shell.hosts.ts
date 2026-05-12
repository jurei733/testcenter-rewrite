import type {
  GetContentReleaseActivationReadinessResponse,
  GetContentReleaseResponse,
  GetImportJobResponse,
  GetSourcePackageResponse
} from "@testcenter-rewrite-app/contracts";
import { productionApiRoutes, resolveRoutePath } from "@testcenter-rewrite-app/contracts";
import type { ContentActionsHost } from "./rewrite-app-shell.content-actions";
import type { ContentDetailsHost } from "./rewrite-app-shell.content-details";
import type { ActivationGuardHost } from "./rewrite-app-shell.activation";
import type { ShellActivationActionsHost } from "./rewrite-app-shell.activation-actions";
import type { WorkspaceContentPresentationHost } from "./rewrite-app-shell.content";
import type { ShellFeedbackHost } from "./rewrite-app-shell.feedback";
import type { ShellOpsHost } from "./rewrite-app-shell.ops";
import type { ShellContentReadsHost } from "./rewrite-app-shell.content-reads";
import type {
  ShellContentState,
  ShellOpsState,
  ShellRuntimeState,
  ShellWorkspaceState
} from "./rewrite-app-shell.state";
import type { RuntimePresentationHost } from "./rewrite-app-shell.runtime";
import type { ShellRuntimeActionsHost } from "./rewrite-app-shell.runtime-actions";
import type { ShellRuntimeReadsHost } from "./rewrite-app-shell.runtime-reads";
import type { ShellWorkspaceActionsHost } from "./rewrite-app-shell.workspace-actions";
import type {
  BlockedActivationFlowHost,
  BootstrapWorkspaceFlowHost,
  ImportActivateFlowHost,
  ParticipantHappyPathFlowHost
} from "./rewrite-app-shell.workflows";
import type { ActivityFeedItem, SummaryCard } from "./rewrite-app-shell.types";

export function createActivationGuardHost(args: {
  getActivationGuardView(): string;
  setActivationGuardView(nextValue: string): void;
  getRuntimeMonitorView(): string;
  setRuntimeMonitorView(nextValue: string): void;
  updateMonitorSummary(headline: string, detail: string): void;
  rememberActivity(title: string, detail: string): void;
}): ActivationGuardHost {
  return {
    getActivationGuardView: args.getActivationGuardView,
    setActivationGuardView: args.setActivationGuardView,
    getRuntimeMonitorView: args.getRuntimeMonitorView,
    setRuntimeMonitorView: args.setRuntimeMonitorView,
    updateMonitorSummary: args.updateMonitorSummary,
    rememberActivity: args.rememberActivity
  };
}

export function createActivationGuardStateHost(args: {
  contentState: ShellContentState;
  runtimeState: ShellRuntimeState;
  updateMonitorSummary(headline: string, detail: string): void;
  rememberActivity(title: string, detail: string): void;
}): ActivationGuardHost {
  return {
    getActivationGuardView: () => args.contentState.activationGuardView,
    setActivationGuardView: nextValue => {
      args.contentState.activationGuardView = nextValue;
    },
    getRuntimeMonitorView: () => args.runtimeState.runtimeMonitorView,
    setRuntimeMonitorView: nextValue => {
      args.runtimeState.runtimeMonitorView = nextValue;
    },
    updateMonitorSummary: args.updateMonitorSummary,
    rememberActivity: args.rememberActivity
  };
}

export function createShellFeedbackHost(args: {
  getSummaryCards(): SummaryCard[];
  setSummaryCards(nextValue: SummaryCard[]): void;
  getActivityFeed(): ActivityFeedItem[];
  setActivityFeed(nextValue: ActivityFeedItem[]): void;
}): ShellFeedbackHost {
  return {
    getSummaryCards: args.getSummaryCards,
    setSummaryCards: args.setSummaryCards,
    getActivityFeed: args.getActivityFeed,
    setActivityFeed: args.setActivityFeed
  };
}

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
    syncRuntimeStateFromRun: testRun => {
      if (!testRun) {
        return;
      }
      args.runtimeState.testRunId = testRun.testRunId || args.runtimeState.testRunId;
      if (testRun.currentUnitKey) {
        args.runtimeState.currentUnitKey = testRun.currentUnitKey;
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

export function createShellOpsStateHost(args: {
  requestJson<T = Record<string, unknown>>(
    label: string,
    path: string,
    quiet?: boolean
  ): Promise<T>;
  opsState: ShellOpsState;
  rememberActivity(title: string, detail: string): void;
}): ShellOpsHost {
  return {
    requestJson: args.requestJson,
    getRuntimeHealthView: () => args.opsState.runtimeHealthView,
    setRuntimeHealthView: nextValue => {
      args.opsState.runtimeHealthView = nextValue;
    },
    getRuntimeMetricsView: () => args.opsState.runtimeMetricsView,
    setRuntimeMetricsView: nextValue => {
      args.opsState.runtimeMetricsView = nextValue;
    },
    getRuntimeDiagnosticsView: () => args.opsState.runtimeDiagnosticsView,
    setRuntimeDiagnosticsView: nextValue => {
      args.opsState.runtimeDiagnosticsView = nextValue;
    },
    getRuntimeConfigView: () => args.opsState.runtimeConfigView,
    setRuntimeConfigView: nextValue => {
      args.opsState.runtimeConfigView = nextValue;
    },
    getStorageKind: () => args.opsState.storageKind,
    setStorageKind: nextValue => {
      args.opsState.storageKind = nextValue;
    },
    getStorageSchemaVersion: () => args.opsState.storageSchemaVersion,
    setStorageSchemaVersion: nextValue => {
      args.opsState.storageSchemaVersion = String(nextValue);
    },
    getReadinessBadge: () => args.opsState.readinessBadge,
    setReadinessBadge: nextValue => {
      args.opsState.readinessBadge = nextValue;
    },
    setDiagnosticsLoaded: nextValue => {
      args.opsState.diagnosticsLoaded = nextValue;
    },
    rememberActivity: args.rememberActivity
  };
}

export function createWorkspaceActionsStateHost(args: {
  request<T>(label: string, method: string, path: string, body?: unknown): Promise<T>;
  workspaceState: ShellWorkspaceState;
  rememberActivity(title: string, detail: string): void;
}): ShellWorkspaceActionsHost {
  return {
    request: args.request,
    getCreateTenantPath: () => productionApiRoutes.platform.createTenant,
    getCreateWorkspacePath: () =>
      resolveRoutePath(productionApiRoutes.workspace.createWorkspace, {
        tenantKey: args.workspaceState.tenantKey.trim()
      }),
    getTenantKey: () => args.workspaceState.tenantKey,
    getWorkspaceKey: () => args.workspaceState.workspaceKey,
    rememberActivity: args.rememberActivity
  };
}

export function createContentReadsStateHost(args: {
  request<T>(
    label: string,
    method: string,
    path: string,
    body?: unknown,
    options?: { quiet?: boolean }
  ): Promise<T>;
  workspaceState: ShellWorkspaceState;
  createWorkspaceContentPresentationHost(): WorkspaceContentPresentationHost;
}): ShellContentReadsHost {
  return {
    request: args.request,
    getWorkspaceOverviewPath: () =>
      resolveRoutePath(productionApiRoutes.workspace.getWorkspaceOverview, {
        tenantKey: args.workspaceState.tenantKey.trim(),
        workspaceKey: args.workspaceState.workspaceKey.trim()
      }),
    getWorkspaceActivityPath: () =>
      resolveRoutePath(productionApiRoutes.workspace.listWorkspaceActivityEvents, {
        tenantKey: args.workspaceState.tenantKey.trim(),
        workspaceKey: args.workspaceState.workspaceKey.trim()
      }),
    getSourcePackagesPath: () =>
      resolveRoutePath(productionApiRoutes.workspace.listSourcePackages, {
        tenantKey: args.workspaceState.tenantKey.trim(),
        workspaceKey: args.workspaceState.workspaceKey.trim()
      }),
    getImportJobsPath: () =>
      resolveRoutePath(productionApiRoutes.workspace.listImportJobs, {
        tenantKey: args.workspaceState.tenantKey.trim(),
        workspaceKey: args.workspaceState.workspaceKey.trim()
      }),
    getParticipantSessionsPath: () =>
      resolveRoutePath(productionApiRoutes.workspace.listParticipantSessions, {
        tenantKey: args.workspaceState.tenantKey.trim(),
        workspaceKey: args.workspaceState.workspaceKey.trim()
      }),
    getContentReleasesPath: () =>
      resolveRoutePath(productionApiRoutes.workspace.listContentReleases, {
        tenantKey: args.workspaceState.tenantKey.trim(),
        workspaceKey: args.workspaceState.workspaceKey.trim()
      }),
    createWorkspaceContentPresentationHost: args.createWorkspaceContentPresentationHost
  };
}

export function createRuntimeActionsStateHost(args: {
  request<T>(label: string, method: string, path: string, body?: unknown): Promise<T>;
  workspaceState: ShellWorkspaceState;
  runtimeState: ShellRuntimeState;
  createRuntimePresentationHost(): RuntimePresentationHost;
  refreshCrossViewStateAfterRuntimeChange(): Promise<void>;
}): ShellRuntimeActionsHost {
  return {
    request: args.request,
    getParticipantSignInPath: () => productionApiRoutes.participant.signIn,
    getResumeParticipantSessionPath: () =>
      resolveRoutePath(productionApiRoutes.participant.resumeSession, {
        participantSessionId: args.runtimeState.participantSessionId.trim()
      }),
    getSaveProgressPath: () =>
      resolveRoutePath(productionApiRoutes.participant.saveProgress, {
        testRunId: args.runtimeState.testRunId.trim()
      }),
    getResumeRunPath: () =>
      resolveRoutePath(productionApiRoutes.participant.resumeRun, {
        testRunId: args.runtimeState.testRunId.trim()
      }),
    getCompleteRunPath: () =>
      resolveRoutePath(productionApiRoutes.participant.completeRun, {
        testRunId: args.runtimeState.testRunId.trim()
      }),
    getWorkspaceKey: () => args.workspaceState.workspaceKey,
    getLoginKey: () => args.runtimeState.loginKey,
    getCurrentUnitKey: () => args.runtimeState.currentUnitKey,
    createRuntimePresentationHost: args.createRuntimePresentationHost,
    refreshCrossViewStateAfterRuntimeChange:
      args.refreshCrossViewStateAfterRuntimeChange
  };
}

export function createRuntimeReadsStateHost(args: {
  request<T>(
    label: string,
    method: string,
    path: string,
    body?: unknown,
    options?: { quiet?: boolean }
  ): Promise<T>;
  isCurrentRunMissingError(error: unknown): boolean;
  workspaceState: ShellWorkspaceState;
  runtimeState: ShellRuntimeState;
  createRuntimePresentationHost(): RuntimePresentationHost;
}): ShellRuntimeReadsHost {
  return {
    request: args.request,
    isCurrentRunMissingError: args.isCurrentRunMissingError,
    getOpenRunsPath: () =>
      resolveRoutePath(productionApiRoutes.monitor.openRuns, {
        tenantKey: args.workspaceState.tenantKey.trim(),
        workspaceKey: args.workspaceState.workspaceKey.trim()
      }),
    getRuntimeStatePath: () =>
      resolveRoutePath(productionApiRoutes.participant.getRuntimeState, {
        participantSessionId: args.runtimeState.participantSessionId.trim()
      }),
    getParticipantSessionDetailPath: () =>
      resolveRoutePath(productionApiRoutes.workspace.getParticipantSession, {
        tenantKey: args.workspaceState.tenantKey.trim(),
        workspaceKey: args.workspaceState.workspaceKey.trim(),
        participantSessionId: args.runtimeState.participantSessionId.trim()
      }),
    getCurrentRunStatePath: () =>
      resolveRoutePath(productionApiRoutes.participant.getCurrentRunState, {
        participantSessionId: args.runtimeState.participantSessionId.trim()
      }),
    createRuntimePresentationHost: args.createRuntimePresentationHost
  };
}

export function createContentActionsStateHost(args: {
  request<T>(
    label: string,
    method: string,
    path: string,
    body?: unknown,
    options?: { quiet?: boolean }
  ): Promise<T>;
  workspaceState: ShellWorkspaceState;
  contentState: ShellContentState;
  persistShellState(): void;
  rememberActivity(title: string, detail: string): void;
  refreshContentReads(quiet?: boolean): Promise<void>;
  loadSourcePackageDetail(): Promise<GetSourcePackageResponse>;
  loadImportJobDetail(): Promise<GetImportJobResponse>;
  loadContentReleaseDetail(): Promise<GetContentReleaseResponse>;
  loadContentReleaseActivationReadiness(): Promise<unknown>;
}): ContentActionsHost {
  return {
    request: args.request,
    getTenantKey: () => args.workspaceState.tenantKey.trim(),
    getWorkspaceKey: () => args.workspaceState.workspaceKey.trim(),
    getSourcePackageId: () => args.contentState.sourcePackageId.trim(),
    getSourceFileName: () => args.contentState.sourceFileName.trim(),
    getSourceMediaType: () => args.contentState.sourceMediaType.trim(),
    getSourceDocument: () => args.contentState.sourceDocument,
    getImportJobId: () => args.contentState.importJobId.trim(),
    getContentReleaseId: () => args.contentState.contentReleaseId.trim(),
    setSourcePackageId: nextValue => {
      args.contentState.sourcePackageId = nextValue;
    },
    setImportJobId: nextValue => {
      args.contentState.importJobId = nextValue;
    },
    setContentReleaseId: nextValue => {
      args.contentState.contentReleaseId = nextValue;
    },
    persistShellState: args.persistShellState,
    rememberActivity: args.rememberActivity,
    refreshContentReads: args.refreshContentReads,
    loadSourcePackageDetail: args.loadSourcePackageDetail,
    loadImportJobDetail: args.loadImportJobDetail,
    loadContentReleaseDetail: args.loadContentReleaseDetail,
    loadContentReleaseActivationReadiness:
      args.loadContentReleaseActivationReadiness
  };
}

export function createContentDetailsStateHost(args: {
  request<T>(
    label: string,
    method: string,
    path: string,
    body?: unknown,
    options?: { quiet?: boolean }
  ): Promise<T>;
  workspaceState: ShellWorkspaceState;
  contentState: ShellContentState;
  persistShellState(): void;
  rememberActivity(title: string, detail: string): void;
  applyActivationReadiness(
    payload: GetContentReleaseActivationReadinessResponse
  ): void;
}): ContentDetailsHost {
  return {
    request: args.request,
    getTenantKey: () => args.workspaceState.tenantKey.trim(),
    getWorkspaceKey: () => args.workspaceState.workspaceKey.trim(),
    getSourcePackageId: () => args.contentState.sourcePackageId.trim(),
    getImportJobId: () => args.contentState.importJobId.trim(),
    getContentReleaseId: () => args.contentState.contentReleaseId.trim(),
    getSourcePackageDetailView: () => args.contentState.sourcePackageDetailView,
    setSourcePackageDetailView: nextValue => {
      args.contentState.sourcePackageDetailView = nextValue;
    },
    getImportJobDetailView: () => args.contentState.importJobDetailView,
    setImportJobDetailView: nextValue => {
      args.contentState.importJobDetailView = nextValue;
    },
    getContentReleaseActivationReadinessView: () =>
      args.contentState.contentReleaseActivationReadinessView,
    setContentReleaseActivationReadinessView: nextValue => {
      args.contentState.contentReleaseActivationReadinessView = nextValue;
    },
    getContentReleaseDetailView: () => args.contentState.contentReleaseDetailView,
    setContentReleaseDetailView: nextValue => {
      args.contentState.contentReleaseDetailView = nextValue;
    },
    setImportJobId: nextValue => {
      args.contentState.importJobId = nextValue;
    },
    setContentReleaseId: nextValue => {
      args.contentState.contentReleaseId = nextValue;
    },
    persistShellState: args.persistShellState,
    rememberActivity: args.rememberActivity,
    applyActivationReadiness: args.applyActivationReadiness
  };
}

export function createActivationActionsStateHost(args: {
  request<T>(label: string, method: string, path: string, body?: unknown): Promise<T>;
  isBlockedActivationError(error: unknown): boolean;
  workspaceState: ShellWorkspaceState;
  contentState: ShellContentState;
  createActivationGuardHost(): ActivationGuardHost;
  rememberActivity(title: string, detail: string): void;
  refreshContentReads(): Promise<void>;
  loadContentReleaseActivationReadiness(): Promise<unknown>;
  loadContentReleaseDetail(): Promise<unknown>;
}): ShellActivationActionsHost {
  return {
    request: args.request,
    isBlockedActivationError: args.isBlockedActivationError,
    getActivateContentReleasePath: () =>
      resolveRoutePath(productionApiRoutes.workspace.activateContentRelease, {
        tenantKey: args.workspaceState.tenantKey.trim(),
        workspaceKey: args.workspaceState.workspaceKey.trim(),
        contentReleaseId: args.contentState.contentReleaseId.trim()
      }),
    getContentReleaseId: () => args.contentState.contentReleaseId.trim(),
    getForceActivation: () => args.contentState.forceActivation,
    createActivationGuardHost: args.createActivationGuardHost,
    rememberActivity: args.rememberActivity,
    refreshContentReads: args.refreshContentReads,
    loadContentReleaseActivationReadiness:
      args.loadContentReleaseActivationReadiness,
    loadContentReleaseDetail: args.loadContentReleaseDetail
  };
}

export function createBootstrapWorkspaceFlowHost(
  args: BootstrapWorkspaceFlowHost
): BootstrapWorkspaceFlowHost {
  return args;
}

export function createImportActivateFlowHost(
  args: ImportActivateFlowHost
): ImportActivateFlowHost {
  return args;
}

export function createBlockedActivationFlowHost(
  args: BlockedActivationFlowHost
): BlockedActivationFlowHost {
  return args;
}

export function createParticipantHappyPathFlowHost(
  args: ParticipantHappyPathFlowHost
): ParticipantHappyPathFlowHost {
  return args;
}
