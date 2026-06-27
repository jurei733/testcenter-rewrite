import type {
  CreateReviewRequest,
  DeleteReviewResponse,
  ReviewResponse,
  DeleteGroupResultsResponse,
  ParticipantSignInRequest,
  ParticipantSignInResponse,
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
  getDeleteGroupResultsPath(): string;
  getCreateReviewPath(): string;
  getUpdateReviewPath(): string;
  getDeleteReviewPath(): string;
  getWorkspaceKey(): string;
  getLoginKey(): string;
  getGroupKey(): string;
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
    host.getResumeParticipantSessionPath()
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
  const payload = await host.request<SaveTestRunProgressResponse>(
    status === "paused" ? "Save Progress Paused" : "Save Progress Running",
    "POST",
    host.getSaveProgressPath(),
    {
      currentUnitKey: host.getCurrentUnitKey().trim() || null,
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
