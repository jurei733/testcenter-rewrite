import { Injectable, inject } from "@angular/core";

import type {
  ParticipantCurrentRunStateResponse,
  ParticipantSignInRequest,
  ParticipantSignInResponse,
  ResumeParticipantSessionResponse,
  ResumeTestRunResponse,
  SaveTestRunProgressRequest,
  SaveTestRunProgressResponse
} from "@testcenter-rewrite-app/contracts";
import {
  productionApiRoutes,
  resolveRoutePath
} from "@testcenter-rewrite-app/contracts";

import { prettyPrintJson } from "./rewrite-app-shell.readers";
import { RewriteAppShellRequestService } from "./rewrite-app-shell-request.service";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";
import { RewriteAppViewStateService } from "./rewrite-app-view-state.service";

type ParticipantPlayerState = {
  headline: string;
  detail: string;
  bookletLabel: string;
  unitLabel: string;
  unitKey: string;
  runStatus: string;
  runId: string;
  actions: string[];
  canSaveProgress: boolean;
  canResumeRun: boolean;
  canComplete: boolean;
  saveProgressLabel: string;
};

type ParticipantEntryParameters = {
  workspaceKey?: string | null;
  loginKey?: string | null;
  participantSessionId?: string | null;
  currentUnitKey?: string | null;
};

type NormalizedParticipantEntryParameters = {
  workspaceKey: string;
  loginKey: string;
  participantSessionId: string;
  currentUnitKey: string;
};

@Injectable({ providedIn: "root" })
export class ParticipantViewFacade {
  private readonly requestState = inject(RewriteAppShellRequestService);
  private readonly uiState = inject(RewriteAppUiStateService);
  private readonly viewState = inject(RewriteAppViewStateService);

  readonly workspace = this.uiState.workspace;
  readonly runtime = this.uiState.runtime;

  init(): void {
    this.viewState.setActiveView("participant");
  }

  persistState(): void {
    this.viewState.persistShellState();
  }

  startFromEntryParameters(parameters: ParticipantEntryParameters): void {
    const normalized = this.applyEntryParameters(parameters);

    if (normalized.participantSessionId) {
      this.viewState.onActionAsync(() => this.resumeSessionInternal());
      return;
    }

    if (normalized.workspaceKey && normalized.loginKey) {
      this.viewState.onActionAsync(async () => {
        await this.signInInternal();
        await this.resumeSessionInternal();
      });
    }
  }

  private applyEntryParameters(
    parameters: ParticipantEntryParameters
  ): NormalizedParticipantEntryParameters {
    const normalized = {
      workspaceKey: parameters.workspaceKey?.trim() ?? "",
      loginKey: parameters.loginKey?.trim() ?? "",
      participantSessionId: parameters.participantSessionId?.trim() ?? "",
      currentUnitKey: parameters.currentUnitKey?.trim() ?? ""
    };

    if (normalized.workspaceKey) {
      const loginChanged =
        normalized.loginKey &&
        normalized.loginKey !== this.runtime.loginKey.trim() &&
        !normalized.participantSessionId;
      this.workspace.workspaceKey = normalized.workspaceKey;
      if (loginChanged) {
        this.runtime.participantSessionId = "";
        this.runtime.testRunId = "";
        this.runtime.currentRunStateView = 'Use "Start Or Resume".';
      }
    }

    if (normalized.loginKey) {
      this.runtime.loginKey = normalized.loginKey;
    }
    if (normalized.participantSessionId) {
      this.runtime.participantSessionId = normalized.participantSessionId;
    }
    if (normalized.currentUnitKey) {
      this.runtime.currentUnitKey = normalized.currentUnitKey;
    }

    if (
      normalized.workspaceKey ||
      normalized.loginKey ||
      normalized.participantSessionId ||
      normalized.currentUnitKey
    ) {
      this.persistState();
    }

    return normalized;
  }

  get player(): ParticipantPlayerState {
    const currentState = this.readCurrentRunState();
    if (!currentState) {
      return {
        headline: this.runtime.participantSessionId.trim()
          ? "Session ready"
          : "Sign in to start",
        detail: this.runtime.participantSessionId.trim()
          ? "Resume the session to launch or continue the current run."
          : "Enter your workspace and login key, then sign in.",
        bookletLabel: "No booklet loaded",
        unitLabel: "No unit loaded",
        unitKey: "n/a",
        runStatus: "idle",
        runId: this.runtime.testRunId.trim() || "no run yet",
        actions: [],
        canSaveProgress: false,
        canResumeRun: false,
        canComplete: false,
        saveProgressLabel: "Save Progress"
      };
    }

    const availableActions = currentState.availableActions;
    const unitLabel =
      currentState.currentUnit.displayLabel ??
      currentState.currentUnit.unitKey ??
      "Untitled unit";

    return {
      headline: unitLabel,
      detail: currentState.booklet.displayLabel,
      bookletLabel: currentState.booklet.displayLabel,
      unitLabel,
      unitKey: currentState.currentUnit.unitKey ?? "n/a",
      runStatus: currentState.testRun.status,
      runId: currentState.testRun.testRunId,
      actions: availableActions,
      canSaveProgress: availableActions.includes("save_progress"),
      canResumeRun: availableActions.includes("resume"),
      canComplete: availableActions.includes("complete"),
      saveProgressLabel:
        currentState.testRun.status === "paused"
          ? "Save Running"
          : "Save Paused"
    };
  }

  signIn(): void {
    this.viewState.onActionAsync(() => this.signInInternal());
  }

  resumeSession(): void {
    this.viewState.onActionAsync(() => this.resumeSessionInternal());
  }

  refreshCurrentState(): void {
    this.viewState.onActionAsync(() => this.refreshCurrentStateInternal(false));
  }

  saveProgressFromPlayer(): void {
    this.viewState.onActionAsync(() =>
      this.saveProgressInternal(this.player.runStatus === "paused" ? "running" : "paused")
    );
  }

  resumeRun(): void {
    this.viewState.onActionAsync(() => this.resumeRunInternal());
  }

  completeRun(): void {
    this.viewState.onActionAsync(() => this.completeRunInternal());
  }

  private async signInInternal(): Promise<void> {
    const payload = await this.requestState.request<ParticipantSignInResponse>(
      "Participant Sign In",
      "POST",
      productionApiRoutes.participant.signIn,
      {
        workspaceKey: this.workspace.workspaceKey.trim(),
        loginKey: this.runtime.loginKey.trim()
      } satisfies ParticipantSignInRequest
    );

    this.runtime.participantSessionId =
      payload.participantSession.participantSessionId;
    this.runtime.runtimeMonitorView = prettyPrintJson(
      payload,
      this.runtime.runtimeMonitorView
    );
    this.persistState();
    await this.refreshCurrentStateInternal(true);
  }

  private async resumeSessionInternal(): Promise<void> {
    const payload = await this.requestState.request<ResumeParticipantSessionResponse>(
      "Participant Resume Session",
      "POST",
      resolveRoutePath(productionApiRoutes.participant.resumeSession, {
        participantSessionId: this.runtime.participantSessionId.trim()
      })
    );

    this.syncRun(payload.testRun);
    this.runtime.runtimeMonitorView = prettyPrintJson(
      payload,
      this.runtime.runtimeMonitorView
    );
    this.persistState();
    await this.refreshCurrentStateInternal(true);
  }

  private async saveProgressInternal(status: "paused" | "running"): Promise<void> {
    const payload = await this.requestState.request<SaveTestRunProgressResponse>(
      status === "paused" ? "Participant Save Paused" : "Participant Save Running",
      "POST",
      resolveRoutePath(productionApiRoutes.participant.saveProgress, {
        testRunId: this.runtime.testRunId.trim()
      }),
      {
        currentUnitKey: this.runtime.currentUnitKey.trim() || null,
        status
      } satisfies SaveTestRunProgressRequest
    );

    this.syncRun(payload.testRun);
    this.runtime.runtimeMonitorView = prettyPrintJson(
      payload,
      this.runtime.runtimeMonitorView
    );
    this.persistState();
    await this.refreshCurrentStateInternal(true);
  }

  private async resumeRunInternal(): Promise<void> {
    const payload = await this.requestState.request<ResumeTestRunResponse>(
      "Participant Resume Run",
      "POST",
      resolveRoutePath(productionApiRoutes.participant.resumeRun, {
        testRunId: this.runtime.testRunId.trim()
      })
    );

    this.syncRun(payload.testRun);
    this.runtime.runtimeMonitorView = prettyPrintJson(
      payload,
      this.runtime.runtimeMonitorView
    );
    this.persistState();
    await this.refreshCurrentStateInternal(true);
  }

  private async completeRunInternal(): Promise<void> {
    const payload = await this.requestState.request<{
      testRun: {
        testRunId: string;
        status: string;
        currentUnitKey?: string | null;
        completedAt?: string | null;
      };
    }>(
      "Participant Complete Run",
      "POST",
      resolveRoutePath(productionApiRoutes.participant.completeRun, {
        testRunId: this.runtime.testRunId.trim()
      })
    );

    this.syncRun(payload.testRun);
    this.runtime.runtimeMonitorView = prettyPrintJson(
      payload,
      this.runtime.runtimeMonitorView
    );
    this.persistState();
    await this.refreshCurrentStateInternal(true);
  }

  private async refreshCurrentStateInternal(quiet: boolean): Promise<void> {
    if (!this.runtime.participantSessionId.trim()) {
      return;
    }

    try {
      const payload =
        await this.requestState.request<ParticipantCurrentRunStateResponse>(
          "Participant Current State",
          "GET",
          resolveRoutePath(productionApiRoutes.participant.getCurrentRunState, {
            participantSessionId: this.runtime.participantSessionId.trim()
          }),
          undefined,
          { quiet }
        );
      this.runtime.currentRunStateView = prettyPrintJson(
        payload,
        this.runtime.currentRunStateView
      );
      this.syncRun(payload.currentRunState.testRun);
      this.persistState();
    } catch (error) {
      if (
        this.requestState.isApiError(error) &&
        error.error === "participant_session_has_no_current_run"
      ) {
        this.runtime.currentRunStateView = prettyPrintJson(
          error,
          this.runtime.currentRunStateView
        );
        this.persistState();
        return;
      }
      throw error;
    }
  }

  private syncRun(testRun: {
    testRunId: string;
    status?: string;
    currentUnitKey?: string | null;
  }): void {
    this.runtime.testRunId = testRun.testRunId;
    if (testRun.currentUnitKey != null) {
      this.runtime.currentUnitKey = testRun.currentUnitKey;
    }
  }

  private readCurrentRunState():
    | ParticipantCurrentRunStateResponse["currentRunState"]
    | null {
    try {
      const payload = JSON.parse(this.runtime.currentRunStateView) as Partial<
        ParticipantCurrentRunStateResponse
      >;
      return payload.currentRunState ?? null;
    } catch {
      return null;
    }
  }
}
