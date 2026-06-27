import type {
  GetParticipantSessionResponse,
  ListDetailedResponsesResponse,
  MonitorOpenRunsResponse,
  ParticipantCurrentRunStateResponse,
  ParticipantRuntimeStateResponse
} from "@testcenter-rewrite-app/contracts";

import {
  applyRuntimeReadsCurrentRunMissing,
  applyRuntimeReadsWithSession,
  applyRuntimeReadsWithoutSession,
  type RuntimePresentationHost
} from "./rewrite-app-shell.runtime";

export interface ShellRuntimeReadsHost {
  request<T>(
    label: string,
    method: string,
    path: string,
    body?: unknown,
    options?: { quiet?: boolean }
  ): Promise<T>;
  isCurrentRunMissingError(error: unknown): boolean;
  getOpenRunsPath(): string;
  getRuntimeStatePath(): string;
  getParticipantSessionDetailPath(): string;
  getDetailedResponsesPath(): string;
  setDetailedResponsesView(nextValue: string): void;
  getResponseCsvExportPath(): string;
  setResponseExportView(nextValue: string): void;
  getCurrentRunStatePath(): string;
  createRuntimePresentationHost(): RuntimePresentationHost;
}

export async function refreshRuntimeReadsAction(
  host: ShellRuntimeReadsHost,
  participantSessionId: string,
  quiet = false
): Promise<void> {
  const openRuns = await host.request<MonitorOpenRunsResponse>(
    "Monitor Open Runs",
    "GET",
    host.getOpenRunsPath(),
    undefined,
    { quiet }
  );

  if (!participantSessionId.trim()) {
    applyRuntimeReadsWithoutSession(
      host.createRuntimePresentationHost(),
      openRuns,
      quiet
    );
    return;
  }

  const [runtimeStatePayload, sessionDetailPayload] = await Promise.all([
    host.request<ParticipantRuntimeStateResponse>(
      "Runtime State",
      "GET",
      host.getRuntimeStatePath(),
      undefined,
      { quiet }
    ),
    host.request<GetParticipantSessionResponse>(
      "Participant Session Detail",
      "GET",
      host.getParticipantSessionDetailPath(),
      undefined,
      { quiet }
    )
  ]);

  let currentRunStatePayload: ParticipantCurrentRunStateResponse | null = null;
  try {
    currentRunStatePayload = await host.request<ParticipantCurrentRunStateResponse>(
      "Current State",
      "GET",
      host.getCurrentRunStatePath(),
      undefined,
      { quiet }
    );
  } catch (error) {
    if (host.isCurrentRunMissingError(error)) {
      applyRuntimeReadsCurrentRunMissing(
        host.createRuntimePresentationHost(),
        runtimeStatePayload.runtimeState.availableAction
      );
    } else {
      throw error;
    }
  }

  applyRuntimeReadsWithSession(
    host.createRuntimePresentationHost(),
    openRuns,
    runtimeStatePayload,
    sessionDetailPayload,
    currentRunStatePayload,
    quiet
  );
}

export async function exportResponsesCsvAction(
  host: ShellRuntimeReadsHost
): Promise<string> {
  const csv = await host.request<string>(
    "Response CSV Export",
    "GET",
    host.getResponseCsvExportPath()
  );
  host.setResponseExportView(csv);
  return csv;
}

export async function loadDetailedResponsesAction(
  host: ShellRuntimeReadsHost
): Promise<ListDetailedResponsesResponse> {
  const payload = await host.request<ListDetailedResponsesResponse>(
    "Detailed Responses",
    "GET",
    host.getDetailedResponsesPath()
  );
  host.setDetailedResponsesView(JSON.stringify(payload, null, 2));
  return payload;
}
