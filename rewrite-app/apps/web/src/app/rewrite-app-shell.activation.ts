import type { GetContentReleaseActivationReadinessResponse } from "@testcenter-rewrite-app/contracts";

import { prettyPrintJson } from "./rewrite-app-shell.readers";

export interface ActivationGuardHost {
  getActivationGuardView(): string;
  setActivationGuardView(nextValue: string): void;
  getRuntimeMonitorView(): string;
  setRuntimeMonitorView(nextValue: string): void;
  updateMonitorSummary(headline: string, detail: string): void;
  rememberActivity(title: string, detail: string): void;
}

export interface ActivationGuardDetails {
  activeContentReleaseId?: string;
  openRuns?: unknown[];
}

export function applyActivationSuccessView(
  host: ActivationGuardHost,
  contentReleaseId: string,
  forceActivation: boolean
): void {
  host.setActivationGuardView(
    prettyPrintJson(
      {
        status: "activated",
        contentReleaseId,
        forceActivation
      },
      host.getActivationGuardView()
    )
  );
}

export function applyBlockedActivationView(
  host: ActivationGuardHost,
  attemptedContentReleaseId: string,
  forceActivation: boolean,
  details: ActivationGuardDetails | undefined,
  runtimeErrorDetails: unknown
): void {
  const openRunCount = Array.isArray(details?.openRuns) ? details.openRuns.length : 0;
  host.updateMonitorSummary(
    openRunCount === 0 ? "Blocked" : String(openRunCount),
    openRunCount === 0
      ? "The API reported an activation guard without open-run details."
      : `Activation blocked by ${openRunCount} open run(s) on release ${details?.activeContentReleaseId ?? "unknown"}.`
  );
  host.setActivationGuardView(
    prettyPrintJson(
      {
        status: "blocked",
        attemptedContentReleaseId,
        activeContentReleaseId: details?.activeContentReleaseId ?? null,
        openRunCount,
        openRuns: details?.openRuns ?? [],
        forceActivation
      },
      host.getActivationGuardView()
    )
  );
  host.setRuntimeMonitorView(
    prettyPrintJson(runtimeErrorDetails, host.getRuntimeMonitorView())
  );
  host.rememberActivity(
    "Activation Blocked",
    openRunCount === 0
      ? "The API reported an activation guard without open-run details."
      : `Release ${details?.activeContentReleaseId ?? "unknown"} still has ${openRunCount} open run(s).`
  );
}

export function applyActivationReadinessView(
  host: ActivationGuardHost,
  payload: GetContentReleaseActivationReadinessResponse
): void {
  const activationReadiness = payload.activationReadiness;
  host.setActivationGuardView(
    prettyPrintJson(
      {
        status: activationReadiness.canActivate ? "ready" : "blocked",
        attemptedContentReleaseId: activationReadiness.contentRelease.contentReleaseId,
        activeContentReleaseId: activationReadiness.activeContentReleaseId,
        openRunCount: activationReadiness.blockingOpenRuns.length,
        openRuns: activationReadiness.blockingOpenRuns
      },
      host.getActivationGuardView()
    )
  );
  host.updateMonitorSummary(
    activationReadiness.canActivate
      ? "Ready"
      : String(activationReadiness.blockingOpenRuns.length),
    activationReadiness.canActivate
      ? "The selected release can be activated without forcing."
      : `The selected release is blocked by ${activationReadiness.blockingOpenRuns.length} open run(s).`
  );
  host.rememberActivity(
    "Release Readiness",
    activationReadiness.canActivate
      ? `Release ${activationReadiness.contentRelease.contentReleaseId} can activate now.`
      : `Release ${activationReadiness.contentRelease.contentReleaseId} is blocked by ${activationReadiness.blockingOpenRuns.length} open run(s).`
  );
}
