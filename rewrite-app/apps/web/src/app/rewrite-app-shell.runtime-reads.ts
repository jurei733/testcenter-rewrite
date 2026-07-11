import type {
  GetParticipantSessionResponse,
  ListDetailedResponsesResponse,
  ListParticipantRosterResponse,
  ListParticipantSessionsResponse,
  ListReviewsResponse,
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
  getParticipantSessionsPath(): string;
  setParticipantSessionsView(nextValue: string): void;
  getParticipantRosterPath(): string;
  setParticipantRosterView(nextValue: string): void;
  getParticipantRosterCsvExportPath(): string;
  setParticipantRosterExportView(nextValue: string): void;
  getRuntimeStatePath(): string;
  getParticipantSessionDetailPath(): string;
  getDetailedResponsesPath(): string;
  setDetailedResponsesView(nextValue: string): void;
  getReviewsPath(): string;
  setReviewsView(nextValue: string): void;
  getResponseCsvExportPath(): string;
  setResponseExportView(nextValue: string): void;
  getReviewCsvExportPath(): string;
  setReviewExportView(nextValue: string): void;
  getCurrentRunStatePath(): string;
  createRuntimePresentationHost(): RuntimePresentationHost;
}

export async function loadParticipantRosterAction(
  host: ShellRuntimeReadsHost,
  quiet = false
): Promise<ListParticipantRosterResponse> {
  const payload = await host.request<ListParticipantRosterResponse>(
    "Participant Roster",
    "GET",
    host.getParticipantRosterPath(),
    undefined,
    { quiet }
  );
  host.setParticipantRosterView(JSON.stringify(payload, null, 2));
  return payload;
}

export async function exportParticipantRosterCsvAction(
  host: ShellRuntimeReadsHost
): Promise<string> {
  const csv = await host.request<string>(
    "Participant Roster CSV Export",
    "GET",
    host.getParticipantRosterCsvExportPath()
  );
  host.setParticipantRosterExportView(csv);
  return csv;
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

export async function loadParticipantSessionsAction(
  host: ShellRuntimeReadsHost,
  quiet = false
): Promise<ListParticipantSessionsResponse> {
  const payload = await host.request<ListParticipantSessionsResponse>(
    "Participant Sessions",
    "GET",
    host.getParticipantSessionsPath(),
    undefined,
    { quiet }
  );
  host.setParticipantSessionsView(JSON.stringify(payload, null, 2));
  return payload;
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

export async function exportReviewsCsvAction(
  host: ShellRuntimeReadsHost
): Promise<string> {
  const csv = await host.request<string>(
    "Review CSV Export",
    "GET",
    host.getReviewCsvExportPath()
  );
  host.setReviewExportView(csv);
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

export async function loadReviewsAction(
  host: ShellRuntimeReadsHost
): Promise<ListReviewsResponse> {
  const payload = await host.request<ListReviewsResponse>(
    "Reviews",
    "GET",
    host.getReviewsPath()
  );
  host.setReviewsView(JSON.stringify(payload, null, 2));
  return payload;
}
