import { ApplicationRef, Injectable, inject } from "@angular/core";

import { RewriteAppApiService, type ApiErrorLike } from "./rewrite-app-api.service";
import {
  applyForegroundShellError,
  applyForegroundShellResponse,
  beginForegroundShellRequest,
  finishForegroundShellRequest
} from "./rewrite-app-shell.request-state";
import { createShellRequestStateHost } from "./rewrite-app-shell.state-hosts";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

@Injectable({ providedIn: "root" })
export class RewriteAppShellRequestService {
  private readonly api = inject(RewriteAppApiService);
  private readonly uiState = inject(RewriteAppUiStateService);
  private readonly applicationRef = inject(ApplicationRef);

  requestJson<T = Record<string, unknown>>(
    label: string,
    path: string,
    quiet = false,
    headers: Record<string, string> = {}
  ): Promise<T> {
    return this.request<T>(label, "GET", path, undefined, { quiet, headers });
  }

  async request<T>(
    label: string,
    method: string,
    path: string,
    body?: unknown,
    options: { quiet?: boolean; headers?: Record<string, string> } = {}
  ): Promise<T> {
    if (!options.quiet) {
      beginForegroundShellRequest(this.createRequestStateHost(), label);
    }

    try {
      const { statusCode, payload } = await this.api.send<T>(
        method,
        path,
        body,
        this.createRequestHeaders(options.headers)
      );
      if (!options.quiet) {
        applyForegroundShellResponse(
          this.createRequestStateHost(),
          label,
          statusCode,
          payload
        );
      }
      return payload;
    } catch (error) {
      if (!options.quiet) {
        const apiError = this.api.isApiError(error)
          ? error
          : ({
              error: "unexpected_error",
              message: error instanceof Error ? error.message : String(error)
            } satisfies ApiErrorLike);
        applyForegroundShellError(this.createRequestStateHost(), label, apiError);
      }
      throw error;
    } finally {
      if (!options.quiet) {
        finishForegroundShellRequest(this.createRequestStateHost());
      }
    }
  }

  isApiError(value: unknown): value is ApiErrorLike {
    return this.api.isApiError(value);
  }

  clearForegroundBusyState(): void {
    this.uiState.foregroundRequestDepth = 0;
    this.uiState.activeRequestLabel.set(null);
  }

  clearErrorMessage(): void {
    this.uiState.errorMessage.set(null);
  }

  setResponseMeta(value: string): void {
    this.uiState.responseMeta.set(value);
  }

  private createRequestStateHost() {
    return createShellRequestStateHost({
      getForegroundRequestDepth: () => this.uiState.foregroundRequestDepth,
      setForegroundRequestDepth: nextValue => {
        this.uiState.foregroundRequestDepth = nextValue;
      },
      activeRequestLabel: this.uiState.activeRequestLabel,
      errorMessage: this.uiState.errorMessage,
      responseMeta: this.uiState.responseMeta,
      lastResponse: this.uiState.lastResponse,
      renderVersion: this.uiState.renderVersion,
      applicationRef: this.applicationRef
    });
  }

  private createRequestHeaders(
    headers: Record<string, string> | undefined
  ): Record<string, string> {
    const adminSessionToken = this.uiState.ops.adminSessionToken.trim();
    return {
      ...(adminSessionToken
        ? { authorization: `Bearer ${adminSessionToken}` }
        : {}),
      ...(headers ?? {})
    };
  }
}
