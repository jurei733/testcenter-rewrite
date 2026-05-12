import type { ActivateContentReleaseResponse } from "@testcenter-rewrite-app/contracts";

import {
  applyActivationSuccessView,
  applyBlockedActivationView,
  type ActivationGuardDetails,
  type ActivationGuardHost
} from "./rewrite-app-shell.activation";

export interface ShellActivationActionsHost {
  request<T>(
    label: string,
    method: string,
    path: string,
    body?: unknown
  ): Promise<T>;
  isBlockedActivationError(error: unknown): boolean;
  getActivateContentReleasePath(): string;
  getContentReleaseId(): string;
  getForceActivation(): boolean;
  createActivationGuardHost(): ActivationGuardHost;
  rememberActivity(title: string, detail: string): void;
  refreshContentReads(): Promise<void>;
  loadContentReleaseActivationReadiness(): Promise<unknown>;
  loadContentReleaseDetail(): Promise<unknown>;
}

export async function activateContentReleaseAction(
  host: ShellActivationActionsHost
): Promise<void> {
  try {
    const payload = await host.request<ActivateContentReleaseResponse>(
      "Activate Content Release",
      "POST",
      host.getActivateContentReleasePath(),
      {
        activatedByActorId: "frontend-angular-shell",
        forceActivation: host.getForceActivation()
      }
    );

    host.rememberActivity(
      "Release Activated",
      `${payload.contentRelease.contentReleaseId} is now ${payload.contentRelease.status}. Force activation: ${host.getForceActivation() ? "on" : "off"}.`
    );

    applyActivationSuccessView(
      host.createActivationGuardHost(),
      payload.contentRelease.contentReleaseId,
      host.getForceActivation()
    );
    await host.refreshContentReads();
    await host.loadContentReleaseActivationReadiness();
    await host.loadContentReleaseDetail();
  } catch (error) {
    if (host.isBlockedActivationError(error)) {
      const details =
        typeof error === "object" &&
        error != null &&
        "details" in error
          ? ((error as { details?: unknown }).details as
              | ActivationGuardDetails
              | undefined)
          : undefined;

      applyBlockedActivationView(
        host.createActivationGuardHost(),
        host.getContentReleaseId(),
        host.getForceActivation(),
        details,
        details
      );
    }
    throw error;
  }
}
