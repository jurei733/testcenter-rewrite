import { Injectable, inject } from "@angular/core";

import {
  RewriteAppApiService,
  type ApiDownload,
  type ApiErrorLike
} from "./rewrite-app-api.service";
import {
  applyForegroundShellError,
  applyForegroundShellResponse,
  beginForegroundShellRequest,
  finishForegroundShellRequest,
  flushShellRender
} from "./rewrite-app-shell.request-state";
import { RewriteAppShellPersistenceService } from "./rewrite-app-shell-persistence.service";
import { createShellRequestStateHost } from "./rewrite-app-shell.state-hosts";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

@Injectable({ providedIn: "root" })
export class RewriteAppShellRequestService {
  private readonly api = inject(RewriteAppApiService);
  private readonly persistence = inject(RewriteAppShellPersistenceService);
  private readonly uiState = inject(RewriteAppUiStateService);
  private adminSessionResetStarted = false;
  private participantAccess: Promise<typeof import("./participant-access-credentials")> | null = null;

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
    options: {
      quiet?: boolean;
      headers?: Record<string, string>;
      onSuccess?: (payload: T, statusCode: number) => void;
    } = {}
  ): Promise<T> {
    if (!options.quiet) {
      beginForegroundShellRequest(this.createRequestStateHost(), label);
    }
    let requestAdminSessionToken: string | null = null;

    try {
      const requestHeaders = await this.createRequestHeaders(path, body, options.headers);
      requestAdminSessionToken = this.readBearerToken(requestHeaders.authorization);
      const { statusCode, payload } = await this.api.send<T>(
        method,
        path,
        body,
        requestHeaders
      );
      if (path.startsWith("/api/v1/participant/") &&
        !(await this.getParticipantAccess()).rememberParticipantAccessResponse(path, payload)) {
        throw new Error("Participant access could not be secured in browser storage.");
      }
      if (!options.quiet) {
        applyForegroundShellResponse(
          this.createRequestStateHost(),
          label,
          statusCode,
          payload
        );
      }
      options.onSuccess?.(payload, statusCode);
      return payload;
    } catch (error) {
      this.resetInvalidAdminSession(error, requestAdminSessionToken);
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
      } else {
        flushShellRender(this.createRequestStateHost());
      }
    }
  }

  async requestDownload(label: string, path: string): Promise<ApiDownload> {
    beginForegroundShellRequest(this.createRequestStateHost(), label);
    let requestAdminSessionToken: string | null = null;
    try {
      const requestHeaders = await this.createRequestHeaders(path, undefined, undefined);
      requestAdminSessionToken = this.readBearerToken(requestHeaders.authorization);
      const download = await this.api.download(path, requestHeaders);
      applyForegroundShellResponse(
        this.createRequestStateHost(),
        label,
        download.statusCode,
        {
          filename: download.filename,
          mediaType: download.blob.type,
          sizeBytes: download.blob.size
        }
      );
      return download;
    } catch (error) {
      this.resetInvalidAdminSession(error, requestAdminSessionToken);
      const apiError = this.api.isApiError(error)
        ? error
        : ({
            error: "unexpected_error",
            message: error instanceof Error ? error.message : String(error)
          } satisfies ApiErrorLike);
      applyForegroundShellError(this.createRequestStateHost(), label, apiError);
      throw error;
    } finally {
      finishForegroundShellRequest(this.createRequestStateHost());
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
    this.uiState.lastApiError.set(null);
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
      lastApiError: this.uiState.lastApiError,
      responseMeta: this.uiState.responseMeta,
      lastResponse: this.uiState.lastResponse,
      renderVersion: this.uiState.renderVersion
    });
  }

  private async createRequestHeaders(
    path: string,
    body: unknown,
    headers: Record<string, string> | undefined
  ): Promise<Record<string, string>> {
    const sessionToken = path.startsWith("/api/v1/participant/")
      ? (await this.getParticipantAccess()).participantRequestToken(path, body)
      : this.uiState.ops.adminSessionToken.trim();
    return {
      ...(sessionToken
        ? { authorization: `Bearer ${sessionToken}` }
        : {}),
      ...(headers ?? {})
    };
  }

  private getParticipantAccess(): Promise<typeof import("./participant-access-credentials")> {
    return this.participantAccess ??= import("./participant-access-credentials");
  }

  private readBearerToken(authorization: string | undefined): string | null {
    const match = /^Bearer\s+(.+)$/i.exec(authorization?.trim() ?? "");
    return match?.[1]?.trim() || null;
  }

  private resetInvalidAdminSession(
    error: unknown,
    requestAdminSessionToken: string | null
  ): void {
    const activeAdminSessionToken = this.uiState.ops.adminSessionToken.trim();
    if (
      this.adminSessionResetStarted ||
      !requestAdminSessionToken ||
      requestAdminSessionToken !== activeAdminSessionToken ||
      !this.api.isApiError(error) ||
      error.statusCode !== 401 ||
      error.error !== "admin_session_invalid"
    ) {
      return;
    }

    this.adminSessionResetStarted = true;
    this.uiState.setAdminSessionToken("");
    this.uiState.ops.adminSessionView = "";
    this.uiState.ops.adminAccessWindowNotice = "";
    this.persistence.persistShellState();
    globalThis.location.reload();
  }
}
