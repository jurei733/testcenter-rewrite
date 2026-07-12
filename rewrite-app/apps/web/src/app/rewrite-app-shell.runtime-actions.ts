import type {
  CreateReviewRequest,
  DeleteReviewResponse,
  ReviewResponse,
  DeleteGroupResultsResponse,
  ImportParticipantRosterRequest,
  ImportParticipantRosterResponse,
  IssueMonitorRunCommandRequest,
  IssueMonitorRunCommandResponse,
  ParticipantSignInRequest,
  ParticipantSignInResponse,
  ResumeParticipantSessionRequest,
  ResumeParticipantSessionResponse,
  ResumeTestRunResponse,
  SaveTestRunProgressRequest,
  SaveTestRunProgressResponse,
  UpdateReviewRequest
} from "@testcenter-rewrite-app/contracts";

import {
  applyCompleteRunResult,
  applyParticipantSignInResult,
  applyResumeParticipantSessionResult,
  applyResumeRunResult,
  applySaveProgressResult,
  type RuntimePresentationHost
} from "./rewrite-app-shell.runtime";

export interface ShellRuntimeActionsHost {
  request<T>(
    label: string,
    method: string,
    path: string,
    body?: unknown
  ): Promise<T>;
  getParticipantSignInPath(): string;
  getResumeParticipantSessionPath(): string;
  getSaveProgressPath(): string;
  getResumeRunPath(): string;
  getCompleteRunPath(): string;
  getMonitorRunCommandPath(): string;
  getDeleteGroupResultsPath(): string;
  getCreateReviewPath(): string;
  getUpdateReviewPath(): string;
  getDeleteReviewPath(): string;
  getImportParticipantRosterPath(): string;
  getTenantKey(): string;
  getWorkspaceKey(): string;
  getEntryRosterText(): string;
  setParticipantRosterView(nextValue: string): void;
  getLoginKey(): string;
  getGroupKey(): string;
  getBookletKey(): string;
  getParticipantSessionId(): string;
  getTestRunId(): string;
  getCurrentUnitKey(): string;
  getCurrentUnitResponse(): string;
  getReviewerId(): string;
  getReviewCategory(): string;
  getReviewComment(): string;
  createRuntimePresentationHost(): RuntimePresentationHost;
  refreshCrossViewStateAfterRuntimeChange(): Promise<void>;
}

export async function importParticipantRosterAction(
  host: ShellRuntimeActionsHost
): Promise<ImportParticipantRosterResponse> {
  const payload = await host.request<ImportParticipantRosterResponse>(
    "Import Participant Roster",
    "POST",
    host.getImportParticipantRosterPath(),
    {
      rosterText: host.getEntryRosterText()
    } satisfies ImportParticipantRosterRequest
  );
  host.setParticipantRosterView(JSON.stringify(payload, null, 2));
  await host.refreshCrossViewStateAfterRuntimeChange();
  return payload;
}

export async function createReviewAction(
  host: ShellRuntimeActionsHost
): Promise<ReviewResponse> {
  const payload = await host.request<ReviewResponse>(
    "Create Review",
    "POST",
    host.getCreateReviewPath(),
    {
      participantSessionId: host.getParticipantSessionId().trim(),
      testRunId: host.getTestRunId().trim(),
      unitKey: host.getCurrentUnitKey().trim() || null,
      reviewerId: host.getReviewerId().trim(),
      category: host.getReviewCategory().trim(),
      comment: host.getReviewComment().trim()
    } satisfies CreateReviewRequest
  );
  await host.refreshCrossViewStateAfterRuntimeChange();
  return payload;
}

export async function updateReviewAction(
  host: ShellRuntimeActionsHost
): Promise<ReviewResponse> {
  const payload = await host.request<ReviewResponse>(
    "Update Review",
    "PATCH",
    host.getUpdateReviewPath(),
    {
      unitKey: host.getCurrentUnitKey().trim() || null,
      reviewerId: host.getReviewerId().trim(),
      category: host.getReviewCategory().trim(),
      comment: host.getReviewComment().trim()
    } satisfies UpdateReviewRequest
  );
  await host.refreshCrossViewStateAfterRuntimeChange();
  return payload;
}

export async function deleteReviewAction(
  host: ShellRuntimeActionsHost
): Promise<DeleteReviewResponse> {
  const payload = await host.request<DeleteReviewResponse>(
    "Delete Review",
    "DELETE",
    host.getDeleteReviewPath()
  );
  await host.refreshCrossViewStateAfterRuntimeChange();
  return payload;
}

export async function deleteGroupResultsAction(
  host: ShellRuntimeActionsHost
): Promise<DeleteGroupResultsResponse> {
  const payload = await host.request<DeleteGroupResultsResponse>(
    "Delete Group Results",
    "DELETE",
    host.getDeleteGroupResultsPath()
  );
  await host.refreshCrossViewStateAfterRuntimeChange();
  return payload;
}

export async function participantSignInAction(
  host: ShellRuntimeActionsHost
): Promise<void> {
  const payload = await host.request<ParticipantSignInResponse>(
    "Participant Sign In",
    "POST",
    host.getParticipantSignInPath(),
    {
      tenantKey: host.getTenantKey().trim() || undefined,
      workspaceKey: host.getWorkspaceKey().trim(),
      loginKey: host.getLoginKey().trim(),
      groupKey: host.getGroupKey().trim() || undefined
    } satisfies ParticipantSignInRequest
  );
  applyParticipantSignInResult(host.createRuntimePresentationHost(), payload);
  await host.refreshCrossViewStateAfterRuntimeChange();
}

export async function resumeParticipantSessionAction(
  host: ShellRuntimeActionsHost
): Promise<void> {
  const payload = await host.request<ResumeParticipantSessionResponse>(
    "Resume Session",
    "POST",
    host.getResumeParticipantSessionPath(),
    {
      bookletKey: host.getBookletKey().trim() || undefined
    } satisfies ResumeParticipantSessionRequest
  );
  applyResumeParticipantSessionResult(
    host.createRuntimePresentationHost(),
    payload
  );
  await host.refreshCrossViewStateAfterRuntimeChange();
}

export async function saveProgressAction(
  host: ShellRuntimeActionsHost,
  status: "paused" | "running"
): Promise<void> {
  const currentUnitKey = host.getCurrentUnitKey().trim();
  const payload = await host.request<SaveTestRunProgressResponse>(
    status === "paused" ? "Save Progress Paused" : "Save Progress Running",
    "POST",
    host.getSaveProgressPath(),
    {
      currentUnitKey: currentUnitKey || undefined,
      status,
      unitResponse: host.getCurrentUnitResponse()
    } satisfies SaveTestRunProgressRequest
  );
  applySaveProgressResult(host.createRuntimePresentationHost(), payload, status);
  await host.refreshCrossViewStateAfterRuntimeChange();
}

export async function resumeRunAction(
  host: ShellRuntimeActionsHost
): Promise<void> {
  const payload = await host.request<ResumeTestRunResponse>(
    "Resume Run",
    "POST",
    host.getResumeRunPath()
  );
  applyResumeRunResult(host.createRuntimePresentationHost(), payload);
  await host.refreshCrossViewStateAfterRuntimeChange();
}

export async function completeRunAction(
  host: ShellRuntimeActionsHost
): Promise<void> {
  const payload = await host.request<{
    testRun: { testRunId: string; status: string; completedAt?: string | null };
  }>("Complete Run", "POST", host.getCompleteRunPath());
  applyCompleteRunResult(host.createRuntimePresentationHost(), payload);
  await host.refreshCrossViewStateAfterRuntimeChange();
}

export async function issueMonitorRunCommandAction(
  host: ShellRuntimeActionsHost,
  commandType: "pause" | "resume" | "complete"
): Promise<IssueMonitorRunCommandResponse> {
  const payload = await host.request<IssueMonitorRunCommandResponse>(
    commandType === "pause"
      ? "Monitor Pause Run"
      : commandType === "resume"
        ? "Monitor Resume Run"
        : "Monitor Complete Run",
    "POST",
    host.getMonitorRunCommandPath(),
    {
      commandType,
      actorId: host.getReviewerId().trim() || undefined
    } satisfies IssueMonitorRunCommandRequest
  );

  if (commandType === "pause") {
    applySaveProgressResult(
      host.createRuntimePresentationHost(),
      { testRun: payload.command.testRun },
      "paused"
    );
  } else if (commandType === "resume") {
    applyResumeRunResult(host.createRuntimePresentationHost(), {
      testRun: payload.command.testRun
    });
  } else {
    applyCompleteRunResult(host.createRuntimePresentationHost(), {
      testRun: payload.command.testRun
    });
  }

  await host.refreshCrossViewStateAfterRuntimeChange();
  return payload;
}
