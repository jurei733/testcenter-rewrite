export interface BootstrapWorkspaceFlowHost {
  createTenant(): Promise<void>;
  createWorkspace(): Promise<void>;
  refreshWorkspaceOverview(): Promise<void>;
  rememberActivity(title: string, detail: string): void;
  tenantKey: string;
  workspaceKey: string;
  allowConflict<T>(
    operation: () => Promise<T>,
    allowedErrorCodes: string[]
  ): Promise<T | undefined>;
}

export interface ImportActivateFlowHost {
  createSourcePackage(): Promise<void>;
  createImportJob(): Promise<void>;
  activateContentRelease(): Promise<void>;
  rememberActivity(title: string, detail: string): void;
  getContentReleaseId(): string;
}

export interface BlockedActivationFlowHost {
  createSourcePackage(): Promise<void>;
  createImportJob(): Promise<void>;
  loadContentReleaseActivationReadiness(): Promise<unknown>;
  activateContentRelease(): Promise<void>;
  rememberActivity(title: string, detail: string): void;
  getContentReleaseId(): string;
  isBlockedActivationError(error: unknown): boolean;
  onBlockedActivation(): void;
}

export interface ParticipantHappyPathFlowHost {
  participantSignIn(): Promise<void>;
  resumeParticipantSession(): Promise<void>;
  refreshRuntimeReads(): Promise<void>;
  rememberActivity(title: string, detail: string): void;
  getParticipantSessionId(): string;
}

export async function runBootstrapWorkspaceFlow(
  host: BootstrapWorkspaceFlowHost
): Promise<void> {
  await host.allowConflict(() => host.createTenant(), ["tenant_key_conflict"]);
  await host.allowConflict(() => host.createWorkspace(), ["workspace_key_conflict"]);
  await host.refreshWorkspaceOverview();
  host.rememberActivity(
    "Guided Flow",
    `Workspace bootstrap completed for ${host.workspaceKey.trim()}.`
  );
}

export async function runImportActivateFlow(
  host: ImportActivateFlowHost
): Promise<void> {
  await host.createSourcePackage();
  await host.createImportJob();
  if (host.getContentReleaseId()) {
    await host.activateContentRelease();
  }
  host.rememberActivity(
    "Guided Flow",
    host.getContentReleaseId()
      ? `Import and activation finished for release ${host.getContentReleaseId()}.`
      : "Import finished without a staged release."
  );
}

export async function runBlockedActivationFlow(
  host: BlockedActivationFlowHost
): Promise<void> {
  await host.createSourcePackage();
  await host.createImportJob();
  if (!host.getContentReleaseId()) {
    host.rememberActivity(
      "Guided Flow",
      "Blocked activation flow stopped because no staged release was produced."
    );
    return;
  }

  await host.loadContentReleaseActivationReadiness();
  try {
    await host.activateContentRelease();
    host.rememberActivity(
      "Guided Flow",
      `Blocked activation flow activated ${host.getContentReleaseId()}; there was no active open-run blocker.`
    );
  } catch (error) {
    if (host.isBlockedActivationError(error)) {
      host.onBlockedActivation();
      host.rememberActivity(
        "Guided Flow",
        `Blocked activation flow confirmed the open-run guard for ${host.getContentReleaseId()}.`
      );
      return;
    }
    throw error;
  }
}

export async function runParticipantHappyPathFlow(
  host: ParticipantHappyPathFlowHost
): Promise<void> {
  await host.participantSignIn();
  await host.resumeParticipantSession();
  await host.refreshRuntimeReads();
  host.rememberActivity(
    "Guided Flow",
    `Participant happy path completed for session ${host.getParticipantSessionId()}.`
  );
}
