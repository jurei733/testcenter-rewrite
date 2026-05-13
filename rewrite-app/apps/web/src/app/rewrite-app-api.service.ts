import { Injectable } from "@angular/core";

import type { ApiErrorResponse } from "@testcenter-rewrite-app/contracts";

export type ApiErrorLike = ApiErrorResponse & {
  statusCode?: number;
};

@Injectable({ providedIn: "root" })
export class RewriteAppApiService {
  async send<T>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders: Record<string, string> = {}
  ): Promise<{ statusCode: number; payload: T }> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...extraHeaders
    };
    const init: RequestInit = {
      method,
      headers
    };

    if (body !== undefined && method !== "GET" && method !== "HEAD") {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    const response = await fetch(path, init);
    const contentType = response.headers.get("content-type") ?? "";
    let payload: unknown = null;

    if (response.status !== 204) {
      payload = contentType.includes("application/json")
        ? await response.json()
        : await response.text();
    }

    if (!response.ok) {
      throw this.normalizeApiError(response.status, payload);
    }

    return {
      statusCode: response.status,
      payload: payload as T
    };
  }

  isApiError(value: unknown): value is ApiErrorLike {
    return value != null && typeof value === "object" && "error" in value;
  }

  private normalizeApiError(statusCode: number, payload: unknown): ApiErrorLike {
    if (payload && typeof payload === "object" && "error" in payload) {
      return {
        ...(payload as ApiErrorResponse),
        statusCode
      };
    }

    return {
      error: "unexpected_error",
      message: typeof payload === "string" ? payload : `HTTP ${statusCode}`,
      statusCode,
      details: payload
    };
  }
}
