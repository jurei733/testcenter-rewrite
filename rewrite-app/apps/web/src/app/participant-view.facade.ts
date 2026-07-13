import { Injectable, inject } from "@angular/core";

import type {
  ParticipantCurrentRunStateResponse,
  ParticipantLaunchRequest,
  ParticipantLaunchResponse,
  ParticipantSignInRequest,
  ParticipantSignInResponse,
  ResumeParticipantSessionRequest,
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
  loginLabel: string;
  groupLabel: string;
  sessionLabel: string;
  bookletLabel: string;
  unitLabel: string;
  unitDescription: string;
  unitContent: string;
  unitKey: string;
  unitPosition: string;
  unitItems: ParticipantPlayerUnitItem[];
  responseProgressLabel: string;
  missingResponseLabel: string;
  progressPercent: number;
  completionLabel: string;
  isComplete: boolean;
  previousUnitKey: string | null;
  nextUnitKey: string | null;
  runStatus: string;
  runId: string;
  actions: string[];
  canSaveProgress: boolean;
  canGoPreviousUnit: boolean;
  canGoNextUnit: boolean;
  canResumeRun: boolean;
  canComplete: boolean;
  saveProgressLabel: string;
  unitResponse: string;
};

type ParticipantPlayerUnitItem = {
  unitKey: string;
  label: string;
  position: string;
  isCurrent: boolean;
  hasResponse: boolean;
  canOpen: boolean;
};

type ParticipantEntryParameters = {
  tenantKey?: string | null;
  workspaceKey?: string | null;
  loginKey?: string | null;
  groupKey?: string | null;
  bookletKey?: string | null;
  participantSessionId?: string | null;
  currentUnitKey?: string | null;
  unitResponse?: string | null;
};

type NormalizedParticipantEntryParameters = {
  tenantKey: string;
  workspaceKey: string;
  loginKey: string;
  groupKey: string;
  bookletKey: string;
  participantSessionId: string;
  currentUnitKey: string;
  unitResponse: string;
  hasUnitResponse: boolean;
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
      this.viewState.onActionAsync(async () => {
        await this.resumeSessionInternal();
        await this.applyEntryDraftAfterResume(normalized);
      });
      return;
    }

    if (normalized.workspaceKey && normalized.loginKey) {
      this.viewState.onActionAsync(async () => {
        await this.starterLaunchInternal();
        await this.applyEntryDraftAfterResume(normalized);
      });
    }
  }

  private applyEntryParameters(
    parameters: ParticipantEntryParameters
  ): NormalizedParticipantEntryParameters {
    const normalized = {
      tenantKey: parameters.tenantKey?.trim() ?? "",
      workspaceKey: parameters.workspaceKey?.trim() ?? "",
      loginKey: parameters.loginKey?.trim() ?? "",
      groupKey: parameters.groupKey?.trim() ?? "",
      bookletKey: parameters.bookletKey?.trim() ?? "",
      participantSessionId: parameters.participantSessionId?.trim() ?? "",
      currentUnitKey: parameters.currentUnitKey?.trim() ?? "",
      unitResponse: parameters.unitResponse ?? "",
      hasUnitResponse: parameters.unitResponse != null
    };
    const previousTenantKey = this.workspace.tenantKey.trim();
    const previousWorkspaceKey = this.workspace.workspaceKey.trim();
    const scopeChanged =
      !normalized.participantSessionId &&
      ((normalized.tenantKey && normalized.tenantKey !== previousTenantKey) ||
        (normalized.workspaceKey && normalized.workspaceKey !== previousWorkspaceKey));

    if (normalized.tenantKey) {
      this.workspace.tenantKey = normalized.tenantKey;
    }

    if (normalized.workspaceKey) {
      const loginChanged =
        normalized.loginKey &&
        normalized.loginKey !== this.runtime.loginKey.trim() &&
        !normalized.participantSessionId;
      this.workspace.workspaceKey = normalized.workspaceKey;
      if (scopeChanged || loginChanged) {
        this.runtime.participantSessionId = "";
        this.runtime.testRunId = "";
        this.runtime.currentRunStateView = 'Use "Start Or Resume".';
      }
    }

    if (normalized.loginKey) {
      this.runtime.loginKey = normalized.loginKey;
    }
    if (normalized.groupKey) {
      this.runtime.groupKey = normalized.groupKey;
    }
    if (normalized.bookletKey) {
      this.runtime.bookletKey = normalized.bookletKey;
    }
    if (normalized.participantSessionId) {
      this.runtime.participantSessionId = normalized.participantSessionId;
    }
    if (normalized.currentUnitKey) {
      this.runtime.currentUnitKey = normalized.currentUnitKey;
    }
    if (normalized.hasUnitResponse) {
      this.runtime.currentUnitResponse = normalized.unitResponse;
    }

    if (
      normalized.tenantKey ||
      normalized.workspaceKey ||
      normalized.loginKey ||
      normalized.groupKey ||
      normalized.bookletKey ||
      normalized.participantSessionId ||
      normalized.currentUnitKey ||
      normalized.hasUnitResponse
    ) {
      this.persistState();
    }

    return normalized;
  }

  private restoreEntryDraft(normalized: NormalizedParticipantEntryParameters): void {
    let shouldPersist = false;

    if (
      normalized.currentUnitKey &&
      this.runtime.currentUnitKey !== normalized.currentUnitKey
    ) {
      this.runtime.currentUnitKey = normalized.currentUnitKey;
      shouldPersist = true;
    }

    if (
      normalized.hasUnitResponse &&
      this.runtime.currentUnitResponse !== normalized.unitResponse
    ) {
      this.runtime.currentUnitResponse = normalized.unitResponse;
      shouldPersist = true;
    }

    if (shouldPersist) {
      this.persistState();
    }
  }

  private async applyEntryDraftAfterResume(
    normalized: NormalizedParticipantEntryParameters
  ): Promise<void> {
    if (normalized.currentUnitKey && this.runtime.testRunId.trim()) {
      this.runtime.currentUnitKey = normalized.currentUnitKey;
      if (normalized.hasUnitResponse) {
        this.runtime.currentUnitResponse = normalized.unitResponse;
      }
      this.persistState();
      await this.saveProgressInternal(
        "running",
        normalized.currentUnitKey,
        normalized.hasUnitResponse ? normalized.unitResponse : undefined
      );
      return;
    }

    this.restoreEntryDraft(normalized);
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
        loginLabel: this.runtime.loginKey.trim() || "No login yet",
        groupLabel: this.runtime.groupKey.trim() || "No group yet",
        sessionLabel: this.runtime.participantSessionId.trim() || "No session yet",
        bookletLabel: "No booklet loaded",
        unitLabel: "No unit loaded",
        unitDescription: "No unit description available yet.",
        unitContent: "Start or resume a session to load the current unit prompt.",
        unitKey: "n/a",
        unitPosition: "n/a",
        unitItems: [],
        responseProgressLabel: "0 / 0 responses saved",
        missingResponseLabel: "No booklet loaded",
        progressPercent: 0,
        completionLabel: "Not started",
        isComplete: false,
        previousUnitKey: null,
        nextUnitKey: null,
        runStatus: "idle",
        runId: this.runtime.testRunId.trim() || "no run yet",
        actions: [],
        canSaveProgress: false,
        canGoPreviousUnit: false,
        canGoNextUnit: false,
        canResumeRun: false,
        canComplete: false,
        saveProgressLabel: "Save Progress",
        unitResponse: ""
      };
    }

    const availableActions = currentState.availableActions;
    const unitLabel =
      currentState.currentUnit.displayLabel ??
      currentState.currentUnit.unitKey ??
      "Untitled unit";
    const unitDescription =
      currentState.currentUnit.description?.trim() ||
      "No additional instructions for this unit.";
    const unitContent =
      currentState.currentUnit.content?.trim() ||
      `Respond to ${unitLabel}.`;
    const unitKey = currentState.currentUnit.unitKey ?? "";
    const bookletUnits = currentState.bookletUnits ?? [];
    const unitIndex = bookletUnits.findIndex(unit => unit.unitKey === unitKey);
    const previousUnitKey =
      unitIndex > 0 ? bookletUnits[unitIndex - 1]?.unitKey ?? null : null;
    const nextUnitKey =
      unitIndex >= 0 && unitIndex < bookletUnits.length - 1
        ? bookletUnits[unitIndex + 1]?.unitKey ?? null
        : null;
    const canNavigateUnits =
      currentState.testRun.status === "running" &&
      availableActions.includes("save_progress");
    const unitItems = bookletUnits.map((unit, index) => ({
      unitKey: unit.unitKey,
      label: unit.displayLabel || unit.unitKey,
      position: `${index + 1}`,
      isCurrent: unit.unitKey === unitKey,
      hasResponse: this.hasSavedResponse(currentState, unit.unitKey),
      canOpen: canNavigateUnits && unit.unitKey !== unitKey
    }));
    const answeredUnitCount = unitItems.filter(unit => unit.hasResponse).length;
    const totalUnitCount = bookletUnits.length;
    const missingUnitCount = Math.max(totalUnitCount - answeredUnitCount, 0);
    const progressPercent =
      totalUnitCount > 0 ? Math.round((answeredUnitCount / totalUnitCount) * 100) : 0;
    const isComplete = currentState.testRun.status === "completed";

    return {
      headline: unitLabel,
      detail: currentState.booklet.displayLabel,
      loginLabel: currentState.participantSession.loginKey,
      groupLabel: currentState.participantSession.groupKey,
      sessionLabel: currentState.participantSession.participantSessionId,
      bookletLabel: currentState.booklet.displayLabel,
      unitLabel,
      unitDescription,
      unitContent,
      unitKey: unitKey || "n/a",
      unitPosition:
        unitIndex >= 0 ? `${unitIndex + 1} / ${bookletUnits.length}` : "n/a",
      unitItems,
      responseProgressLabel: `${answeredUnitCount} / ${totalUnitCount} responses saved`,
      missingResponseLabel:
        missingUnitCount === 0
          ? "All units have a saved response."
          : `${missingUnitCount} ${missingUnitCount === 1 ? "unit" : "units"} without a saved response.`,
      progressPercent,
      completionLabel: isComplete
        ? currentState.testRun.completedAt
          ? `Completed ${currentState.testRun.completedAt}`
          : "Completed"
        : "Not completed yet",
      isComplete,
      previousUnitKey,
      nextUnitKey,
      runStatus: currentState.testRun.status,
      runId: currentState.testRun.testRunId,
      actions: availableActions,
      canSaveProgress: availableActions.includes("save_progress"),
      canGoPreviousUnit: canNavigateUnits && previousUnitKey != null,
      canGoNextUnit: canNavigateUnits && nextUnitKey != null,
      canResumeRun: availableActions.includes("resume"),
      canComplete: availableActions.includes("complete"),
      saveProgressLabel:
        currentState.testRun.status === "paused"
          ? "Save Running"
          : "Save Paused",
      unitResponse: unitKey ? currentState.testRun.unitResponses[unitKey] ?? "" : ""
    };
  }

  signIn(): void {
    this.viewState.onActionAsync(() => this.signInInternal());
  }

  resumeSession(): void {
    this.viewState.onActionAsync(() => this.startOrResumeInternal());
  }

  refreshCurrentState(): void {
    this.viewState.onActionAsync(() => this.refreshCurrentStateInternal(false));
  }

  saveProgressFromPlayer(): void {
    this.viewState.onActionAsync(() =>
      this.saveProgressInternal(
        this.player.runStatus === "paused" ? "running" : "paused",
        this.runtime.currentUnitKey.trim() || undefined,
        this.runtime.currentUnitResponse
      )
    );
  }

  goToPreviousUnit(): void {
    this.viewState.onActionAsync(() => this.goToPlayerUnitInternal("previous"));
  }

  goToNextUnit(): void {
    this.viewState.onActionAsync(() => this.goToPlayerUnitInternal("next"));
  }

  goToUnit(unitKey: string): void {
    this.viewState.onActionAsync(() => this.goToPlayerUnitInternal(unitKey));
  }

  resumeRun(): void {
    this.viewState.onActionAsync(() => this.resumeRunInternal());
  }

  completeRun(): void {
    const player = this.player;
    const effectiveCompletionState = this.getEffectiveCompletionState(player);
    if (
      player.canComplete &&
      !player.isComplete &&
      effectiveCompletionState.progressPercent < 100 &&
      !globalThis.window?.confirm(
        `Complete this test with ${effectiveCompletionState.missingResponseLabel.toLowerCase()}`
      )
    ) {
      return;
    }
    this.viewState.onActionAsync(() => this.completeRunInternal());
  }

  private async signInInternal(): Promise<void> {
    const payload = await this.requestState.request<ParticipantSignInResponse>(
      "Participant Sign In",
      "POST",
      productionApiRoutes.participant.signIn,
      {
        tenantKey: this.workspace.tenantKey.trim() || undefined,
        workspaceKey: this.workspace.workspaceKey.trim(),
        loginKey: this.runtime.loginKey.trim(),
        groupKey: this.runtime.groupKey.trim() || undefined
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

  private async startOrResumeInternal(): Promise<void> {
    if (this.runtime.participantSessionId.trim()) {
      await this.resumeSessionInternal();
      return;
    }

    await this.starterLaunchInternal();
  }

  private async starterLaunchInternal(): Promise<void> {
    const payload = await this.requestState.request<ParticipantLaunchResponse>(
      "Participant Starter Launch",
      "POST",
      productionApiRoutes.participant.launch,
      {
        tenantKey: this.workspace.tenantKey.trim() || undefined,
        workspaceKey: this.workspace.workspaceKey.trim(),
        loginKey: this.runtime.loginKey.trim(),
        groupKey: this.runtime.groupKey.trim() || undefined,
        bookletKey: this.runtime.bookletKey.trim() || undefined
      } satisfies ParticipantLaunchRequest
    );

    this.runtime.participantSessionId =
      payload.participantSession.participantSessionId;
    this.syncRun(payload.testRun);
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
      }),
      {
        bookletKey: this.runtime.bookletKey.trim() || undefined
      } satisfies ResumeParticipantSessionRequest
    );

    this.syncRun(payload.testRun);
    this.runtime.runtimeMonitorView = prettyPrintJson(
      payload,
      this.runtime.runtimeMonitorView
    );
    this.persistState();
    await this.refreshCurrentStateInternal(true);
  }

  private async saveProgressInternal(
    status: "paused" | "running",
    currentUnitKey = this.runtime.currentUnitKey.trim() || undefined,
    unitResponse?: string | null
  ): Promise<void> {
    const payload = await this.requestState.request<SaveTestRunProgressResponse>(
      status === "paused" ? "Participant Save Paused" : "Participant Save Running",
      "POST",
      resolveRoutePath(productionApiRoutes.participant.saveProgress, {
        testRunId: this.runtime.testRunId.trim()
      }),
      {
        currentUnitKey,
        status,
        unitResponse
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

  private async goToPlayerUnitInternal(
    target: "previous" | "next" | string
  ): Promise<void> {
    const player = this.player;
    const targetUnitKey =
      target === "previous"
        ? player.previousUnitKey
        : target === "next"
          ? player.nextUnitKey
          : target.trim();
    if (!targetUnitKey) {
      return;
    }

    const targetUnit = player.unitItems.find(unit => unit.unitKey === targetUnitKey);
    if (targetUnitKey === player.unitKey || !targetUnit?.canOpen) {
      return;
    }

    const currentUnitKey = this.runtime.currentUnitKey.trim();
    if (currentUnitKey) {
      await this.saveProgressInternal(
        "running",
        currentUnitKey,
        this.runtime.currentUnitResponse
      );
    }
    await this.saveProgressInternal("running", targetUnitKey);
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
    await this.saveCurrentDraftBeforeCompleteInternal();

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

  private async saveCurrentDraftBeforeCompleteInternal(): Promise<void> {
    const player = this.player;
    const currentUnitKey = this.runtime.currentUnitKey.trim();
    if (
      !player.canSaveProgress ||
      !this.runtime.testRunId.trim() ||
      !currentUnitKey
    ) {
      return;
    }

    await this.saveProgressInternal(
      player.runStatus === "paused" ? "paused" : "running",
      currentUnitKey,
      this.runtime.currentUnitResponse
    );
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
      this.syncCurrentUnitResponse(payload.currentRunState);
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

  private syncCurrentUnitResponse(
    currentState: ParticipantCurrentRunStateResponse["currentRunState"]
  ): void {
    const unitKey = currentState.currentUnit.unitKey;
    this.runtime.currentUnitResponse = unitKey
      ? currentState.testRun.unitResponses[unitKey] ?? ""
      : "";
  }

  private hasSavedResponse(
    currentState: ParticipantCurrentRunStateResponse["currentRunState"],
    unitKey: string
  ): boolean {
    return Object.prototype.hasOwnProperty.call(
      currentState.testRun.unitResponses,
      unitKey
    );
  }

  private getEffectiveCompletionState(player: ParticipantPlayerState): {
    progressPercent: number;
    missingResponseLabel: string;
  } {
    const currentState = this.readCurrentRunState();
    const currentUnitKey = this.runtime.currentUnitKey.trim();
    const draftAddsCurrentResponse =
      currentState != null &&
      currentUnitKey.length > 0 &&
      this.runtime.currentUnitResponse.length > 0 &&
      !this.hasSavedResponse(currentState, currentUnitKey);
    if (!draftAddsCurrentResponse || player.unitItems.length === 0) {
      return {
        progressPercent: player.progressPercent,
        missingResponseLabel: player.missingResponseLabel
      };
    }

    const answeredUnitCount =
      player.unitItems.filter(unit => unit.hasResponse).length + 1;
    const totalUnitCount = player.unitItems.length;
    const missingUnitCount = Math.max(totalUnitCount - answeredUnitCount, 0);

    return {
      progressPercent: Math.round((answeredUnitCount / totalUnitCount) * 100),
      missingResponseLabel:
        missingUnitCount === 0
          ? "All units have a saved response."
          : `${missingUnitCount} ${missingUnitCount === 1 ? "unit" : "units"} without a saved response.`
    };
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
