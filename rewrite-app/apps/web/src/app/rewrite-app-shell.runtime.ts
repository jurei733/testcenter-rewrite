import type {
  GetParticipantSessionResponse,
  MonitorOpenRunsResponse,
  ParticipantCurrentRunStateResponse,
  ParticipantLaunchResponse,
  ParticipantRuntimeStateResponse,
  ParticipantSignInResponse,
  ResumeParticipantSessionResponse,
  ResumeTestRunResponse,
  SaveTestRunProgressResponse
} from "@testcenter-rewrite-app/contracts";
import { productionApiRoutes, resolveRoutePath } from "@testcenter-rewrite-app/contracts";

import { prettyPrintJson } from "./rewrite-app-shell.readers";

export interface RuntimePresentationHost {
  request<T>(
    label: string,
    method: string,
    path: string,
    body?: unknown,
    options?: { quiet?: boolean }
  ): Promise<T>;
  getTenantKey(): string;
  getWorkspaceKey(): string;
  getParticipantSessionId(): string;
  setParticipantSessionId(nextValue: string): void;
  setGroupKey(nextValue: string): void;
  setParticipantDisplayName(nextValue: string): void;
  syncRuntimeStateFromRun(testRun: RuntimeTestRunLike): void;
  getOpenRunsView(): string;
  setOpenRunsView(nextValue: string): void;
  getRuntimeStateView(): string;
  setRuntimeStateView(nextValue: string): void;
  getCurrentRunStateView(): string;
  setCurrentRunStateView(nextValue: string): void;
  getParticipantSessionDetailView(): string;
  setParticipantSessionDetailView(nextValue: string): void;
  getRuntimeMonitorView(): string;
  setRuntimeMonitorView(nextValue: string): void;
  setRuntimeLoaded(nextValue: boolean): void;
  updateRuntimeSummary(headline: string, detail: string): void;
  updateMonitorSummary(headline: string, detail: string): void;
  rememberActivity(title: string, detail: string): void;
}

type RuntimeTestRunLike =
  | {
      testRunId: string;
      status?: string;
      bookletKey?: string;
      currentUnitKey?: string | null;
      unitResponses?: Record<string, string>;
      completedAt?: string | null;
    }
  | null
  | undefined;

export function applyParticipantSignInResult(
  host: RuntimePresentationHost,
  payload: ParticipantSignInResponse
): void {
  host.setParticipantSessionId(payload.participantSession.participantSessionId);
  host.setGroupKey(payload.participantSession.groupKey);
  host.setParticipantDisplayName(payload.participantRosterEntry?.displayName ?? "");
  host.updateRuntimeSummary(
    payload.participantSession.status,
    `Session ${payload.participantSession.participantSessionId} signed in for login ${payload.participantSession.loginKey}.`
  );
  host.setRuntimeMonitorView(
    prettyPrintJson(payload, host.getRuntimeMonitorView())
  );
  host.rememberActivity(
    "Participant Signed In",
    `Session ${payload.participantSession.participantSessionId} is ready.`
  );
}

export function applyResumeParticipantSessionResult(
  host: RuntimePresentationHost,
  payload: ResumeParticipantSessionResponse
): void {
  host.syncRuntimeStateFromRun(payload.testRun);
  host.updateRuntimeSummary(
    payload.testRun.status,
    `Run ${payload.testRun.testRunId} resumed at ${payload.testRun.currentUnitKey ?? "no current unit"}.`
  );
  host.setRuntimeMonitorView(
    prettyPrintJson(payload, host.getRuntimeMonitorView())
  );
  host.rememberActivity(
    "Session Resumed",
    `Run ${payload.testRun.testRunId} is ${payload.testRun.status}.`
  );
}

export function applyParticipantLaunchResult(
  host: RuntimePresentationHost,
  payload: ParticipantLaunchResponse
): void {
  host.setParticipantSessionId(payload.participantSession.participantSessionId);
  host.setGroupKey(payload.participantSession.groupKey);
  host.setParticipantDisplayName(payload.participantRosterEntry?.displayName ?? "");
  host.syncRuntimeStateFromRun(payload.testRun);
  host.updateRuntimeSummary(
    payload.testRun.status,
    `Run ${payload.testRun.testRunId} launched at ${payload.testRun.currentUnitKey ?? "no current unit"}.`
  );
  host.setRuntimeMonitorView(
    prettyPrintJson(payload, host.getRuntimeMonitorView())
  );
  host.rememberActivity(
    "Participant Started",
    `Session ${payload.participantSession.participantSessionId} started ${payload.testRun.bookletKey}.`
  );
}

export function applySaveProgressResult(
  host: RuntimePresentationHost,
  payload: SaveTestRunProgressResponse,
  status: "paused" | "running"
): void {
  host.syncRuntimeStateFromRun(payload.testRun);
  host.updateRuntimeSummary(
    payload.testRun.status,
    status === "paused"
      ? `Run parked at ${payload.testRun.currentUnitKey ?? "no unit"}.`
      : `Run is active at ${payload.testRun.currentUnitKey ?? "no unit"}.`
  );
  host.setRuntimeMonitorView(
    prettyPrintJson(payload, host.getRuntimeMonitorView())
  );
  host.rememberActivity(
    "Progress Saved",
    status === "paused"
      ? `Run ${payload.testRun.testRunId} is now paused at ${payload.testRun.currentUnitKey ?? "no unit"}.`
      : `Run ${payload.testRun.testRunId} continues at ${payload.testRun.currentUnitKey ?? "no unit"}.`
  );
}

export function applyResumeRunResult(
  host: RuntimePresentationHost,
  payload: ResumeTestRunResponse
): void {
  host.syncRuntimeStateFromRun(payload.testRun);
  host.updateRuntimeSummary(
    payload.testRun.status,
    `Run resumed at ${payload.testRun.currentUnitKey ?? "no unit"}.`
  );
  host.setRuntimeMonitorView(
    prettyPrintJson(payload, host.getRuntimeMonitorView())
  );
  host.rememberActivity(
    "Run Resumed",
    `Run ${payload.testRun.testRunId} is running again.`
  );
}

export function applyCompleteRunResult(
  host: RuntimePresentationHost,
  payload: { testRun: { testRunId: string; status: string; completedAt?: string | null } }
): void {
  host.syncRuntimeStateFromRun(payload.testRun);
  host.updateRuntimeSummary(
    payload.testRun.status,
    `Run ${payload.testRun.testRunId} completed at ${payload.testRun.completedAt ?? "unknown"}.`
  );
  host.setRuntimeMonitorView(
    prettyPrintJson(payload, host.getRuntimeMonitorView())
  );
  host.rememberActivity(
    "Run Completed",
    `Run ${payload.testRun.testRunId} is closed.`
  );
}

export function applyRuntimeReadsWithoutSession(
  host: RuntimePresentationHost,
  openRuns: MonitorOpenRunsResponse,
  quiet: boolean,
  options: { monitorOnly?: boolean } = {}
): void {
  const openRunCount = openRuns.items.length;
  host.setOpenRunsView(prettyPrintJson(openRuns, host.getOpenRunsView()));
  host.updateMonitorSummary(
    openRunCount === 0 ? "Clear" : String(openRunCount),
    openRunCount === 0
      ? "No open runs are blocking activation."
      : `${openRunCount} open run(s) could block a new activation.`
  );
  host.setRuntimeStateView(
    prettyPrintJson(
    {
      status: options.monitorOnly
        ? "monitor_scope_loaded"
        : "participant_session_required",
      message: options.monitorOnly
        ? "The monitor console intentionally loads only scoped open-run data."
        : "Sign in a participant or enter a session id to hydrate runtime reads."
    },
    host.getRuntimeStateView()
    )
  );
  host.setCurrentRunStateView(
    prettyPrintJson(
    {
      status: options.monitorOnly
        ? "select_open_run"
        : "participant_session_required",
      message: options.monitorOnly
        ? "Select an open run to prepare monitor commands."
        : "Current run state appears after a participant session is available."
    },
    host.getCurrentRunStateView()
    )
  );
  host.setRuntimeLoaded(true);
  if (!quiet) {
    host.rememberActivity(
      options.monitorOnly ? "Monitor Scope Refreshed" : "Runtime Refresh",
      options.monitorOnly
        ? openRunCount === 0
          ? "No open runs are visible in the assigned monitor scope."
          : `${openRunCount} open run(s) are visible in the assigned monitor scope.`
        : openRunCount === 0
          ? "Monitor is clear; sign in a participant to load runtime state."
          : `Monitor sees ${openRunCount} open run(s); sign in a participant to inspect session state.`
    );
  }
}

export function applyRuntimeReadsCurrentRunMissing(
  host: RuntimePresentationHost,
  availableAction: string | null | undefined
): void {
  host.setCurrentRunStateView(
    prettyPrintJson(
    {
      status: "participant_session_has_no_current_run",
      message:
        "The participant session is signed in but has not started a test run yet.",
      availableAction
    },
    host.getCurrentRunStateView()
    )
  );
}

export function applyRuntimeReadsWithSession(
  host: RuntimePresentationHost,
  openRuns: MonitorOpenRunsResponse,
  runtimeStatePayload: ParticipantRuntimeStateResponse,
  sessionDetailPayload: GetParticipantSessionResponse,
  currentRunStatePayload: ParticipantCurrentRunStateResponse | null,
  quiet: boolean
): void {
  const openRunCount = openRuns.items.length;
  host.setOpenRunsView(prettyPrintJson(openRuns, host.getOpenRunsView()));
  host.updateMonitorSummary(
    openRunCount === 0 ? "Clear" : String(openRunCount),
    openRunCount === 0
      ? "No open runs are blocking activation."
      : `${openRunCount} open run(s) could block a new activation.`
  );

  host.setRuntimeStateView(
    prettyPrintJson(runtimeStatePayload, host.getRuntimeStateView())
  );
  if (currentRunStatePayload) {
    host.setCurrentRunStateView(
      prettyPrintJson(
        currentRunStatePayload,
        host.getCurrentRunStateView()
      )
    );
  }
  host.setParticipantSessionDetailView(
    prettyPrintJson(
      sessionDetailPayload,
      host.getParticipantSessionDetailView()
    )
  );
  host.setRuntimeMonitorView(
    prettyPrintJson(
      {
        runtimeState: runtimeStatePayload.runtimeState,
        currentRunState: currentRunStatePayload?.currentRunState ?? null,
        openRuns
      },
      host.getRuntimeMonitorView()
    )
  );

  host.setRuntimeLoaded(true);
  host.setGroupKey(
    sessionDetailPayload.participantSessionDetail.participantSession.groupKey
  );
  host.syncRuntimeStateFromRun(runtimeStatePayload.runtimeState.latestTestRun);
  host.updateRuntimeSummary(
    runtimeStatePayload.runtimeState.availableAction ??
      runtimeStatePayload.runtimeState.runtimeStatus,
    currentRunStatePayload?.currentRunState.currentUnit
      ? `Current unit: ${currentRunStatePayload.currentRunState.currentUnit.displayLabel}.`
      : runtimeStatePayload.runtimeState.latestTestRun
        ? `Run ${runtimeStatePayload.runtimeState.latestTestRun.testRunId} is ${runtimeStatePayload.runtimeState.latestTestRun.status}.`
        : `Session is ${runtimeStatePayload.runtimeState.runtimeStatus}.`
  );

  if (!quiet) {
    host.rememberActivity(
      "Runtime Refresh",
      currentRunStatePayload?.currentRunState.currentUnit
        ? `Session ${host.getParticipantSessionId().trim()} is ${runtimeStatePayload.runtimeState.runtimeStatus} at ${currentRunStatePayload.currentRunState.currentUnit.displayLabel}.`
        : runtimeStatePayload.runtimeState.availableAction === "launch"
          ? `Session ${host.getParticipantSessionId().trim()} is ready to launch its first run.`
          : `Session ${host.getParticipantSessionId().trim()} is ${runtimeStatePayload.runtimeState.runtimeStatus}.`
    );
  }
}

export async function loadParticipantSessionDetailAction(
  host: RuntimePresentationHost
): Promise<GetParticipantSessionResponse> {
  const payload = await host.request<GetParticipantSessionResponse>(
    "Participant Session Detail",
    "GET",
    resolveRoutePath(productionApiRoutes.workspace.getParticipantSession, {
      tenantKey: host.getTenantKey(),
      workspaceKey: host.getWorkspaceKey(),
      participantSessionId: host.getParticipantSessionId().trim()
    })
  );
  host.setParticipantSessionDetailView(
    prettyPrintJson(payload, host.getParticipantSessionDetailView())
  );
  const participantSession = payload.participantSessionDetail.participantSession;
  host.rememberActivity(
    "Participant Session Detail",
    `Session ${participantSession.participantSessionId} is ${participantSession.status}.`
  );
  return payload;
}
