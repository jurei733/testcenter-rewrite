import type { ApplicationRef, WritableSignal } from "@angular/core";

import type { ShellLifecycleHost } from "./rewrite-app-shell.lifecycle";
import type { ShellRequestStateHost } from "./rewrite-app-shell.request-state";
import type {
  ShellContentState,
  ShellOpsState,
  ShellRuntimeState,
  ShellWorkspaceState
} from "./rewrite-app-shell.state";
import type { ShellPersistenceTarget } from "./rewrite-app-shell.storage";
import type { AppView } from "./rewrite-app-shell.types";

export function createShellLifecycleStateHost(args: {
  workspaceState: ShellWorkspaceState;
  contentState: ShellContentState;
  runtimeState: ShellRuntimeState;
  opsState: ShellOpsState;
  getActiveView(): AppView;
  setActiveView(nextValue: AppView): void;
  getAutoRefreshHandle(): number | null;
  setAutoRefreshHandle(nextValue: number | null): void;
  refreshWorkspaceOverview(quiet?: boolean): Promise<void>;
  refreshContentReads(quiet?: boolean): Promise<void>;
  refreshRuntimeReads(quiet?: boolean): Promise<void>;
  refreshOperationalDiagnostics(quiet?: boolean): Promise<void>;
}): ShellLifecycleHost {
  return {
    get activeView() {
      return args.getActiveView();
    },
    set activeView(nextValue) {
      args.setActiveView(nextValue);
    },
    get workspaceLoaded() {
      return args.workspaceState.workspaceLoaded;
    },
    set workspaceLoaded(nextValue) {
      args.workspaceState.workspaceLoaded = nextValue;
    },
    get contentLoaded() {
      return args.contentState.contentLoaded;
    },
    set contentLoaded(nextValue) {
      args.contentState.contentLoaded = nextValue;
    },
    get runtimeLoaded() {
      return args.runtimeState.runtimeLoaded;
    },
    set runtimeLoaded(nextValue) {
      args.runtimeState.runtimeLoaded = nextValue;
    },
    get diagnosticsLoaded() {
      return args.opsState.diagnosticsLoaded;
    },
    set diagnosticsLoaded(nextValue) {
      args.opsState.diagnosticsLoaded = nextValue;
    },
    get autoRefreshEnabled() {
      return args.workspaceState.autoRefreshEnabled;
    },
    set autoRefreshEnabled(nextValue) {
      args.workspaceState.autoRefreshEnabled = nextValue;
    },
    get autoRefreshSeconds() {
      return args.workspaceState.autoRefreshSeconds;
    },
    set autoRefreshSeconds(nextValue) {
      args.workspaceState.autoRefreshSeconds = nextValue;
    },
    get autoRefreshHandle() {
      return args.getAutoRefreshHandle();
    },
    set autoRefreshHandle(nextValue) {
      args.setAutoRefreshHandle(nextValue);
    },
    refreshWorkspaceOverview: args.refreshWorkspaceOverview,
    refreshContentReads: args.refreshContentReads,
    refreshRuntimeReads: args.refreshRuntimeReads,
    refreshOperationalDiagnostics: args.refreshOperationalDiagnostics
  };
}

export function createShellPersistenceStateHost(args: {
  workspaceState: ShellWorkspaceState;
  contentState: ShellContentState;
  runtimeState: ShellRuntimeState;
  opsState: ShellOpsState;
  getActiveView(): AppView;
  setActiveView(nextValue: AppView): void;
  getShowRawDebug(): boolean;
  setShowRawDebug(nextValue: boolean): void;
}): ShellPersistenceTarget {
  return {
    get tenantKey() {
      return args.workspaceState.tenantKey;
    },
    set tenantKey(nextValue) {
      args.workspaceState.tenantKey = nextValue;
    },
    get workspaceKey() {
      return args.workspaceState.workspaceKey;
    },
    set workspaceKey(nextValue) {
      args.workspaceState.workspaceKey = nextValue;
    },
    get sourceFileName() {
      return args.contentState.sourceFileName;
    },
    set sourceFileName(nextValue) {
      args.contentState.sourceFileName = nextValue;
    },
    get sourceMediaType() {
      return args.contentState.sourceMediaType;
    },
    set sourceMediaType(nextValue) {
      args.contentState.sourceMediaType = nextValue;
    },
    get sourceDocument() {
      return args.contentState.sourceDocument;
    },
    set sourceDocument(nextValue) {
      args.contentState.sourceDocument = nextValue;
    },
    get sourcePackageId() {
      return args.contentState.sourcePackageId;
    },
    set sourcePackageId(nextValue) {
      args.contentState.sourcePackageId = nextValue;
    },
    get importJobId() {
      return args.contentState.importJobId;
    },
    set importJobId(nextValue) {
      args.contentState.importJobId = nextValue;
    },
    get contentReleaseId() {
      return args.contentState.contentReleaseId;
    },
    set contentReleaseId(nextValue) {
      args.contentState.contentReleaseId = nextValue;
    },
    get participantSessionId() {
      return args.runtimeState.participantSessionId;
    },
    set participantSessionId(nextValue) {
      args.runtimeState.participantSessionId = nextValue;
    },
    get testRunId() {
      return args.runtimeState.testRunId;
    },
    set testRunId(nextValue) {
      args.runtimeState.testRunId = nextValue;
    },
    get currentUnitKey() {
      return args.runtimeState.currentUnitKey;
    },
    set currentUnitKey(nextValue) {
      args.runtimeState.currentUnitKey = nextValue;
    },
    get loginKey() {
      return args.runtimeState.loginKey;
    },
    set loginKey(nextValue) {
      args.runtimeState.loginKey = nextValue;
    },
    get groupKey() {
      return args.runtimeState.groupKey;
    },
    set groupKey(nextValue) {
      args.runtimeState.groupKey = nextValue;
    },
    get autoRefreshEnabled() {
      return args.workspaceState.autoRefreshEnabled;
    },
    set autoRefreshEnabled(nextValue) {
      args.workspaceState.autoRefreshEnabled = nextValue;
    },
    get autoRefreshSeconds() {
      return args.workspaceState.autoRefreshSeconds;
    },
    set autoRefreshSeconds(nextValue) {
      args.workspaceState.autoRefreshSeconds = nextValue;
    },
    get forceActivation() {
      return args.contentState.forceActivation;
    },
    set forceActivation(nextValue) {
      args.contentState.forceActivation = nextValue;
    },
    get adminUsername() {
      return args.opsState.adminUsername;
    },
    set adminUsername(nextValue) {
      args.opsState.adminUsername = nextValue;
    },
    get adminDisplayName() {
      return args.opsState.adminDisplayName;
    },
    set adminDisplayName(nextValue) {
      args.opsState.adminDisplayName = nextValue;
    },
    get adminSessionToken() {
      return args.opsState.adminSessionToken;
    },
    set adminSessionToken(nextValue) {
      args.opsState.adminSessionToken = nextValue;
    },
    get adminCreateUsername() {
      return args.opsState.adminCreateUsername;
    },
    set adminCreateUsername(nextValue) {
      args.opsState.adminCreateUsername = nextValue;
    },
    get adminCreateDisplayName() {
      return args.opsState.adminCreateDisplayName;
    },
    set adminCreateDisplayName(nextValue) {
      args.opsState.adminCreateDisplayName = nextValue;
    },
    get adminCreateRole() {
      return args.opsState.adminCreateRole;
    },
    set adminCreateRole(nextValue) {
      args.opsState.adminCreateRole = nextValue;
    },
    get adminCreateTenantKey() {
      return args.opsState.adminCreateTenantKey;
    },
    set adminCreateTenantKey(nextValue) {
      args.opsState.adminCreateTenantKey = nextValue;
    },
    get adminCreateWorkspaceKey() {
      return args.opsState.adminCreateWorkspaceKey;
    },
    set adminCreateWorkspaceKey(nextValue) {
      args.opsState.adminCreateWorkspaceKey = nextValue;
    },
    get adminRoleTargetUserId() {
      return args.opsState.adminRoleTargetUserId;
    },
    set adminRoleTargetUserId(nextValue) {
      args.opsState.adminRoleTargetUserId = nextValue;
    },
    get adminRoleRole() {
      return args.opsState.adminRoleRole;
    },
    set adminRoleRole(nextValue) {
      args.opsState.adminRoleRole = nextValue;
    },
    get adminRoleTenantKey() {
      return args.opsState.adminRoleTenantKey;
    },
    set adminRoleTenantKey(nextValue) {
      args.opsState.adminRoleTenantKey = nextValue;
    },
    get adminRoleWorkspaceKey() {
      return args.opsState.adminRoleWorkspaceKey;
    },
    set adminRoleWorkspaceKey(nextValue) {
      args.opsState.adminRoleWorkspaceKey = nextValue;
    },
    get adminRevokeTargetUserId() {
      return args.opsState.adminRevokeTargetUserId;
    },
    set adminRevokeTargetUserId(nextValue) {
      args.opsState.adminRevokeTargetUserId = nextValue;
    },
    get adminRevokeRoleAssignmentId() {
      return args.opsState.adminRevokeRoleAssignmentId;
    },
    set adminRevokeRoleAssignmentId(nextValue) {
      args.opsState.adminRevokeRoleAssignmentId = nextValue;
    },
    get adminStatusTargetUserId() {
      return args.opsState.adminStatusTargetUserId;
    },
    set adminStatusTargetUserId(nextValue) {
      args.opsState.adminStatusTargetUserId = nextValue;
    },
    get adminStatusValue() {
      return args.opsState.adminStatusValue;
    },
    set adminStatusValue(nextValue) {
      args.opsState.adminStatusValue = nextValue;
    },
    get adminResetTargetUserId() {
      return args.opsState.adminResetTargetUserId;
    },
    set adminResetTargetUserId(nextValue) {
      args.opsState.adminResetTargetUserId = nextValue;
    },
    get showRawDebug() {
      return args.getShowRawDebug();
    },
    set showRawDebug(nextValue) {
      args.setShowRawDebug(nextValue);
    },
    get activeView() {
      return args.getActiveView();
    },
    set activeView(nextValue) {
      args.setActiveView(nextValue);
    }
  };
}

export function createShellRequestStateHost(args: {
  getForegroundRequestDepth(): number;
  setForegroundRequestDepth(nextValue: number): void;
  activeRequestLabel: WritableSignal<string | null>;
  errorMessage: WritableSignal<string | null>;
  responseMeta: WritableSignal<string>;
  lastResponse: WritableSignal<string>;
  renderVersion: WritableSignal<number>;
  applicationRef: ApplicationRef;
}): ShellRequestStateHost {
  return {
    get foregroundRequestDepth() {
      return args.getForegroundRequestDepth();
    },
    set foregroundRequestDepth(nextValue) {
      args.setForegroundRequestDepth(nextValue);
    },
    activeRequestLabel: args.activeRequestLabel,
    errorMessage: args.errorMessage,
    responseMeta: args.responseMeta,
    lastResponse: args.lastResponse,
    renderVersion: args.renderVersion,
    applicationRef: args.applicationRef
  };
}
