import type { ApplicationRef, WritableSignal } from "@angular/core";

import type { ApiErrorLike } from "./rewrite-app-api.service";
import { prettyPrintJson } from "./rewrite-app-shell.readers";

export interface ShellRequestStateHost {
  foregroundRequestDepth: number;
  readonly activeRequestLabel: WritableSignal<string | null>;
  readonly errorMessage: WritableSignal<string | null>;
  readonly responseMeta: WritableSignal<string>;
  readonly lastResponse: WritableSignal<string>;
  readonly renderVersion: WritableSignal<number>;
  readonly applicationRef: ApplicationRef;
}

export function beginForegroundShellRequest(
  host: ShellRequestStateHost,
  label: string
): void {
  host.foregroundRequestDepth += 1;
  host.activeRequestLabel.set(label);
  host.errorMessage.set(null);
}

export function applyForegroundShellResponse(
  host: ShellRequestStateHost,
  label: string,
  statusCode: number,
  payload: unknown
): void {
  host.responseMeta.set(`${label} · ${statusCode}`);
  host.lastResponse.set(prettyPrintJson(payload, `HTTP ${statusCode}`));
}

export function applyForegroundShellError(
  host: ShellRequestStateHost,
  label: string,
  apiError: ApiErrorLike
): void {
  host.errorMessage.set(apiError.message);
  host.responseMeta.set(`${label} · error`);
  host.lastResponse.set(prettyPrintJson(apiError, host.lastResponse()));
}

export function finishForegroundShellRequest(
  host: ShellRequestStateHost
): void {
  host.foregroundRequestDepth = Math.max(0, host.foregroundRequestDepth - 1);
  if (host.foregroundRequestDepth === 0) {
    host.activeRequestLabel.set(null);
  }
  flushShellRender(host);
}

export function flushShellRender(host: ShellRequestStateHost): void {
  host.renderVersion.update(version => version + 1);
  host.applicationRef.tick();
}
