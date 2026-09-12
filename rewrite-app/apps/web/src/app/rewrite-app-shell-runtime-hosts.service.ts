import { Injectable, inject } from "@angular/core";

import {
  createRuntimeActionsStateHost,
  createRuntimeReadsStateHost
} from "./rewrite-app-shell.hosts";
import { RewriteAppShellRuntimePresentationService } from "./rewrite-app-shell-runtime-presentation.service";
import { RewriteAppShellRequestService } from "./rewrite-app-shell-request.service";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

@Injectable({ providedIn: "root" })
export class RewriteAppShellRuntimeHostsService {
  private readonly presentationHosts = inject(RewriteAppShellRuntimePresentationService);
  private readonly requestState = inject(RewriteAppShellRequestService);
  private readonly uiState = inject(RewriteAppUiStateService);

  private readonly workspaceState = this.uiState.workspace;
  private readonly runtimeState = this.uiState.runtime;

  createRuntimeActionsHost(refreshCrossViewStateAfterRuntimeChange: () => Promise<void>) {
    return createRuntimeActionsStateHost({
      request: <T>(
        label: string,
        method: string,
        path: string,
        body?: unknown,
        onSuccess?: (payload: T) => void
      ) =>
        this.requestState.request<T>(label, method, path, body, { onSuccess }),
      workspaceState: this.workspaceState,
      runtimeState: this.runtimeState,
      createRuntimePresentationHost: () =>
        this.presentationHosts.createRuntimePresentationHost(),
      refreshCrossViewStateAfterRuntimeChange
    });
  }

  createRuntimeReadsHost() {
    return createRuntimeReadsStateHost({
      request: <T>(
        label: string,
        method: string,
        path: string,
        body?: unknown,
        options: { quiet?: boolean } = {}
      ) => this.requestState.request<T>(label, method, path, body, options),
      isCurrentRunMissingError: (error: unknown) =>
        this.requestState.isApiError(error) &&
        error.error === "participant_session_has_no_current_run",
      isParticipantSessionMissingError: (error: unknown) =>
        this.requestState.isApiError(error) &&
        error.error === "participant_session_not_found",
      workspaceState: this.workspaceState,
      runtimeState: this.runtimeState,
      createRuntimePresentationHost: () =>
        this.presentationHosts.createRuntimePresentationHost()
    });
  }
}
