import type { AppView, PersistedShellState } from "./rewrite-app-shell.types";

export type ShellPersistenceTarget = {
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

export const createPersistedShellState = (
  target: ShellPersistenceTarget
): PersistedShellState => ({
  tenantKey: target.tenantKey,
  workspaceKey: target.workspaceKey,
  sourceFileName: target.sourceFileName,
  sourceMediaType: target.sourceMediaType,
  sourceDocument: target.sourceDocument,
  sourcePackageId: target.sourcePackageId,
  importJobId: target.importJobId,
  contentReleaseId: target.contentReleaseId,
  participantSessionId: target.participantSessionId,
  testRunId: target.testRunId,
  currentUnitKey: target.currentUnitKey,
  loginKey: target.loginKey,
  autoRefreshEnabled: target.autoRefreshEnabled,
  autoRefreshSeconds: target.autoRefreshSeconds,
  forceActivation: target.forceActivation,
  activeView: target.activeView
});

export const applyHydratedShellState = (
  target: ShellPersistenceTarget,
  snapshot: Partial<PersistedShellState>
): void => {
  target.tenantKey = snapshot.tenantKey ?? target.tenantKey;
  target.workspaceKey = snapshot.workspaceKey ?? target.workspaceKey;
  target.sourceFileName = snapshot.sourceFileName ?? target.sourceFileName;
  target.sourceMediaType = snapshot.sourceMediaType ?? target.sourceMediaType;
  target.sourceDocument = snapshot.sourceDocument ?? target.sourceDocument;
  target.sourcePackageId = snapshot.sourcePackageId ?? target.sourcePackageId;
  target.importJobId = snapshot.importJobId ?? target.importJobId;
  target.contentReleaseId = snapshot.contentReleaseId ?? target.contentReleaseId;
  target.participantSessionId = snapshot.participantSessionId ?? target.participantSessionId;
  target.testRunId = snapshot.testRunId ?? target.testRunId;
  target.currentUnitKey = snapshot.currentUnitKey ?? target.currentUnitKey;
  target.loginKey = snapshot.loginKey ?? target.loginKey;
  target.autoRefreshEnabled = snapshot.autoRefreshEnabled ?? target.autoRefreshEnabled;
  target.autoRefreshSeconds = snapshot.autoRefreshSeconds ?? target.autoRefreshSeconds;
  target.forceActivation = snapshot.forceActivation ?? target.forceActivation;
  target.activeView = snapshot.activeView ?? target.activeView;
};
