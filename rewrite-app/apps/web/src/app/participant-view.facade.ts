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
  sessionEntryLink: string;
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
  completionReadinessLabel: string;
  completionReadinessDetail: string;
  completionReadinessState: "idle" | "incomplete" | "ready" | "complete";
  isComplete: boolean;
  previousUnitKey: string | null;
  nextUnitKey: string | null;
  runStatus: string;
  runId: string;
  nextStepLabel: string;
  nextStepDetail: string;
  actions: string[];
  canSaveProgress: boolean;
  canGoPreviousUnit: boolean;
  canGoNextUnit: boolean;
  canResumeRun: boolean;
  canComplete: boolean;
  saveProgressLabel: string;
  unitResponse: string;
  draftStateLabel: string;
  draftStateDetail: string;
  hasUnsavedResponse: boolean;
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
        await this.resumeEntrySessionInternal(normalized);
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
      const assignmentChanged =
        !normalized.participantSessionId &&
        ((normalized.groupKey &&
          normalized.groupKey !== this.runtime.groupKey.trim()) ||
          (normalized.bookletKey &&
            normalized.bookletKey !== this.runtime.bookletKey.trim()));
      this.workspace.workspaceKey = normalized.workspaceKey;
      if (scopeChanged || loginChanged || assignmentChanged) {
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
      const hasParticipantSession = Boolean(this.runtime.participantSessionId.trim());
      return {
        headline: hasParticipantSession
          ? "Session ready"
          : "Sign in to start",
        detail: hasParticipantSession
          ? "Resume the session to launch or continue the current run."
          : "Enter your workspace and login key, then sign in.",
        loginLabel: this.runtime.loginKey.trim() || "No login yet",
        groupLabel: this.runtime.groupKey.trim() || "No group yet",
        sessionLabel: this.runtime.participantSessionId.trim() || "No session yet",
        sessionEntryLink: this.createParticipantSessionEntryLink(),
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
        completionReadinessLabel: "Not ready",
        completionReadinessDetail:
          "Start or resume a test before checking completion readiness.",
        completionReadinessState: "idle",
        isComplete: false,
        previousUnitKey: null,
        nextUnitKey: null,
        runStatus: hasParticipantSession ? "signed_in" : "idle",
        runId: this.runtime.testRunId.trim() || "no run yet",
        nextStepLabel: hasParticipantSession ? "Start test" : "Sign in",
        nextStepDetail: hasParticipantSession
          ? 'Use "Start Or Resume" to open the assigned booklet.'
          : "Enter the assigned workspace and login key first.",
        actions: [],
        canSaveProgress: false,
        canGoPreviousUnit: false,
        canGoNextUnit: false,
        canResumeRun: false,
        canComplete: false,
        saveProgressLabel: "Save Progress",
        unitResponse: "",
        draftStateLabel: "No response loaded",
        draftStateDetail: "Start or resume a test before writing an answer.",
        hasUnsavedResponse: false
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
    const savedUnitResponse = unitKey
      ? currentState.testRun.unitResponses[unitKey] ?? ""
      : "";
    const currentDraft = this.runtime.currentUnitResponse;
    const hasUnsavedResponse =
      currentState.testRun.status !== "completed" && currentDraft !== savedUnitResponse;
    const effectiveCompletion = this.getEffectiveCompletionState({
      answeredUnitCount,
      currentDraft,
      currentUnitKey: unitKey,
      hasUnsavedResponse,
      isComplete,
      totalUnitCount,
      unitItems
    });
    const draftStateLabel = this.getDraftStateLabel({
      canSaveProgress: availableActions.includes("save_progress"),
      hasSavedResponse: savedUnitResponse.length > 0,
      hasUnsavedResponse,
      isComplete
    });
    const draftStateDetail = this.getDraftStateDetail({
      hasUnsavedResponse,
      savedUnitResponse,
      currentDraft,
      isComplete
    });

    return {
      headline: unitLabel,
      detail: currentState.booklet.displayLabel,
      loginLabel: currentState.participantSession.loginKey,
      groupLabel: currentState.participantSession.groupKey,
      sessionLabel: currentState.participantSession.participantSessionId,
      sessionEntryLink: this.createParticipantSessionEntryLink(),
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
      completionReadinessLabel: effectiveCompletion.label,
      completionReadinessDetail: effectiveCompletion.detail,
      completionReadinessState: effectiveCompletion.state,
      isComplete,
      previousUnitKey,
      nextUnitKey,
      runStatus: currentState.testRun.status,
      runId: currentState.testRun.testRunId,
      nextStepLabel: this.getNextStepLabel(currentState.testRun.status),
      nextStepDetail: this.getNextStepDetail({
        availableActions,
        isComplete,
        missingResponseLabel:
          missingUnitCount === 0
            ? "All units have a saved response."
            : `${missingUnitCount} ${missingUnitCount === 1 ? "unit" : "units"} without a saved response.`
      }),
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
      unitResponse: savedUnitResponse,
      draftStateLabel,
      draftStateDetail,
      hasUnsavedResponse
    };
  }

  resumeSession(): void {
    this.viewState.onActionAsync(() => this.startOrResumeInternal());
  }

  signIn(): void {
    this.viewState.onActionAsync(() => this.signInInternal());
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
    if (
      player.canComplete &&
      !player.isComplete &&
      player.completionReadinessState !== "ready" &&
      !globalThis.window?.confirm(
        `Complete this test with ${player.completionReadinessLabel.toLowerCase()}?`
      )
    ) {
      return;
    }
    this.viewState.onActionAsync(() => this.completeRunInternal());
  }

  private async startOrResumeInternal(): Promise<void> {
    if (this.runtime.participantSessionId.trim()) {
      try {
        await this.resumeSessionInternal({ quiet: true });
        return;
      } catch (error) {
        if (!this.isStoredParticipantSessionMissing(error)) {
          throw error;
        }
        this.clearStoredParticipantSession();
      }
    }

    await this.starterLaunchInternal();
  }

  private async resumeEntrySessionInternal(
    normalized: NormalizedParticipantEntryParameters
  ): Promise<void> {
    try {
      await this.resumeSessionInternal();
      await this.applyEntryDraftAfterResume(normalized);
    } catch (error) {
      if (!this.isParticipantSessionNoLongerResumable(error)) {
        throw error;
      }

      await this.refreshCurrentStateInternal(true);
    }
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

    this.syncParticipantSessionFields(payload.participantSession);
    this.runtime.testRunId = "";
    this.runtime.currentUnitKey = "";
    this.runtime.currentUnitResponse = "";
    this.runtime.currentRunStateView = prettyPrintJson(
      {
        status: "participant_signed_in",
        message: 'Session is ready. Use "Start Or Resume" to open the test run.',
        participantSession: payload.participantSession
      },
      this.runtime.currentRunStateView
    );
    this.runtime.runtimeMonitorView = prettyPrintJson(
      payload,
      this.runtime.runtimeMonitorView
    );
    this.persistState();
  }

  private clearStoredParticipantSession(): void {
    if (
      !this.runtime.participantSessionId.trim() &&
      !this.runtime.testRunId.trim()
    ) {
      return;
    }

    this.runtime.participantSessionId = "";
    this.runtime.testRunId = "";
    this.runtime.currentRunStateView =
      'Stored participant session is gone. Use "Start Or Resume".';
    this.persistState();
  }

  private isStoredParticipantSessionMissing(error: unknown): boolean {
    return (
      this.requestState.isApiError(error) &&
      error.error === "participant_session_not_found"
    );
  }

  private isParticipantSessionNoLongerResumable(error: unknown): boolean {
    return (
      this.requestState.isApiError(error) &&
      error.error === "participant_session_has_no_resumable_run"
    );
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

    this.syncParticipantSessionFields(payload.participantSession);
    this.syncRun(payload.testRun);
    this.runtime.runtimeMonitorView = prettyPrintJson(
      payload,
      this.runtime.runtimeMonitorView
    );
    this.persistState();
    await this.refreshCurrentStateInternal(true);
  }

  private async resumeSessionInternal(options: { quiet?: boolean } = {}): Promise<void> {
    const payload = await this.requestState.request<ResumeParticipantSessionResponse>(
      "Participant Resume Session",
      "POST",
      resolveRoutePath(productionApiRoutes.participant.resumeSession, {
        participantSessionId: this.runtime.participantSessionId.trim()
      }),
      {
        bookletKey: this.runtime.bookletKey.trim() || undefined
      } satisfies ResumeParticipantSessionRequest,
      { quiet: options.quiet ?? false }
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
      this.syncCurrentRunState(payload.currentRunState);
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
    bookletKey?: string;
  }): void {
    this.runtime.testRunId = testRun.testRunId;
    if (testRun.bookletKey) {
      this.runtime.bookletKey = testRun.bookletKey;
    }
    if (testRun.currentUnitKey != null) {
      this.runtime.currentUnitKey = testRun.currentUnitKey;
    }
  }

  private syncParticipantSessionFields(participantSession: {
    participantSessionId: string;
    loginKey: string;
    groupKey: string;
  }): void {
    this.runtime.participantSessionId = participantSession.participantSessionId;
    this.runtime.loginKey = participantSession.loginKey;
    this.runtime.groupKey = participantSession.groupKey;
  }

  private syncCurrentRunState(
    currentState: ParticipantCurrentRunStateResponse["currentRunState"]
  ): void {
    this.syncParticipantSessionFields(currentState.participantSession);
    this.syncRun(currentState.testRun);
  }

  private syncCurrentUnitResponse(
    currentState: ParticipantCurrentRunStateResponse["currentRunState"]
  ): void {
    const unitKey = currentState.currentUnit.unitKey;
    this.runtime.currentUnitResponse = unitKey
      ? currentState.testRun.unitResponses[unitKey] ?? ""
      : "";
  }

  private createParticipantSessionEntryLink(): string {
    const participantSessionId = this.runtime.participantSessionId.trim();
    if (!participantSessionId) {
      return "";
    }

    const query = new URLSearchParams({ participantSessionId });
    const currentState = this.readCurrentRunState();
    this.appendParticipantEntryLinkParam(query, "tenantKey", this.workspace.tenantKey);
    this.appendParticipantEntryLinkParam(
      query,
      "workspaceKey",
      this.workspace.workspaceKey
    );
    this.appendParticipantEntryLinkParam(
      query,
      "loginKey",
      currentState?.participantSession.loginKey ?? this.runtime.loginKey
    );
    this.appendParticipantEntryLinkParam(
      query,
      "groupKey",
      currentState?.participantSession.groupKey ?? this.runtime.groupKey
    );
    this.appendParticipantEntryLinkParam(
      query,
      "bookletKey",
      currentState?.testRun.bookletKey ?? this.runtime.bookletKey
    );
    const origin = globalThis.window?.location?.origin ?? "";
    return `${origin}/participant?${query.toString()}`;
  }

  private appendParticipantEntryLinkParam(
    query: URLSearchParams,
    key: string,
    value?: string | null
  ): void {
    const normalizedValue = value?.trim();
    if (normalizedValue) {
      query.set(key, normalizedValue);
    }
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

  private getEffectiveCompletionState(args: {
    answeredUnitCount: number;
    currentDraft: string;
    currentUnitKey: string;
    hasUnsavedResponse: boolean;
    isComplete: boolean;
    totalUnitCount: number;
    unitItems: ParticipantPlayerUnitItem[];
  }): {
    label: string;
    detail: string;
    state: ParticipantPlayerState["completionReadinessState"];
  } {
    if (args.isComplete) {
      return {
        label: "Complete",
        detail: "This test run is closed and ready for operator review.",
        state: "complete"
      };
    }

    if (args.totalUnitCount === 0) {
      return {
        label: "Not ready",
        detail: "No booklet units are loaded yet.",
        state: "idle"
      };
    }

    const draftAddsCurrentResponse =
      args.currentUnitKey.length > 0 &&
      args.currentDraft.length > 0 &&
      !args.unitItems.some(
        unit => unit.unitKey === args.currentUnitKey && unit.hasResponse
      );
    const answeredUnitCount = args.answeredUnitCount + (draftAddsCurrentResponse ? 1 : 0);
    const totalUnitCount = args.totalUnitCount;
    const missingUnitCount = Math.max(totalUnitCount - answeredUnitCount, 0);
    const missingResponseLabel =
      missingUnitCount === 0
        ? "all units will have a saved response"
        : `${missingUnitCount} ${missingUnitCount === 1 ? "unit" : "units"} still missing`;

    if (missingUnitCount === 0) {
      return {
        label: "Ready to complete",
        detail: args.hasUnsavedResponse
          ? "All units will be answered after Complete Test saves the current draft."
          : "All units already have saved responses.",
        state: "ready"
      };
    }

    return {
      label: `${missingUnitCount} ${missingUnitCount === 1 ? "response" : "responses"} missing`,
      detail: args.hasUnsavedResponse
        ? `Complete Test will save this draft, but ${missingResponseLabel}.`
        : `${missingResponseLabel} before the test is fully answered.`,
      state: "incomplete"
    };
  }

  private getDraftStateLabel(args: {
    canSaveProgress: boolean;
    hasSavedResponse: boolean;
    hasUnsavedResponse: boolean;
    isComplete: boolean;
  }): string {
    if (args.isComplete) {
      return "Completed";
    }
    if (!args.canSaveProgress) {
      return "Read only";
    }
    if (args.hasUnsavedResponse) {
      return "Unsaved draft";
    }
    return args.hasSavedResponse ? "Saved" : "No response yet";
  }

  private getDraftStateDetail(args: {
    hasUnsavedResponse: boolean;
    savedUnitResponse: string;
    currentDraft: string;
    isComplete: boolean;
  }): string {
    if (args.isComplete) {
      return "This test is complete; responses are no longer editable.";
    }
    if (args.hasUnsavedResponse) {
      return "Use save, navigation, or Complete Test to store this answer. Complete Test saves this draft before closing.";
    }
    if (args.savedUnitResponse.length > 0) {
      return "The answer shown here matches the saved response for this unit.";
    }
    if (args.currentDraft.length > 0) {
      return "The current answer is ready to save.";
    }
    return "Write an answer, then save or move to another unit.";
  }

  private getNextStepLabel(status: string): string {
    if (status === "completed") {
      return "Completed";
    }
    if (status === "paused") {
      return "Resume test";
    }
    return "Answer current unit";
  }

  private getNextStepDetail(args: {
    availableActions: string[];
    isComplete: boolean;
    missingResponseLabel: string;
  }): string {
    if (args.isComplete) {
      return "This test run is closed and ready for operator review.";
    }
    if (args.availableActions.includes("resume")) {
      return 'Use "Resume Run" or save a running answer to continue.';
    }
    if (args.availableActions.includes("save_progress")) {
      return `${args.missingResponseLabel} Save, navigate, or complete when ready.`;
    }
    return "No participant action is available for this run.";
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
