import { Injectable, inject, signal } from "@angular/core";

import type {
  GetApplicationSettingsResponse,
  UpdateApplicationSettingsRequest,
  UpdateApplicationSettingsResponse
} from "@testcenter-rewrite-app/contracts";
import { productionApiRoutes } from "@testcenter-rewrite-app/contracts";
import {
  defaultApplicationSettings,
  type ApplicationSettings
} from "@testcenter-rewrite-app/domain";

import { RewriteAppApiService } from "./rewrite-app-api.service";

const MAX_TIMER_DELAY_MS = 2_147_000_000;

@Injectable({ providedIn: "root" })
export class ApplicationSettingsService {
  private readonly api = inject(RewriteAppApiService);
  private warningExpirationTimer: ReturnType<typeof setTimeout> | null = null;

  readonly settings = signal<ApplicationSettings>({
    ...defaultApplicationSettings
  });
  readonly activeWarningText = signal<string | null>(null);
  readonly loaded = signal(false);
  readonly lastError = signal<string | null>(null);

  async load(): Promise<ApplicationSettings> {
    try {
      const { payload } = await this.api.send<GetApplicationSettingsResponse>(
        "GET",
        productionApiRoutes.system.getApplicationSettings
      );
      this.lastError.set(null);
      this.apply(payload.applicationSettings);
      return payload.applicationSettings;
    } catch (error) {
      this.lastError.set(this.describeError(error));
      throw error;
    }
  }

  async update(
    sessionToken: string,
    input: UpdateApplicationSettingsRequest
  ): Promise<ApplicationSettings> {
    try {
      const { payload } = await this.api.send<UpdateApplicationSettingsResponse>(
        "PATCH",
        productionApiRoutes.admin.updateApplicationSettings,
        input,
        { Authorization: `Bearer ${sessionToken}` }
      );
      this.lastError.set(null);
      this.apply(payload.applicationSettings);
      return payload.applicationSettings;
    } catch (error) {
      this.lastError.set(this.describeError(error));
      throw error;
    }
  }

  private apply(settings: ApplicationSettings): void {
    this.settings.set(settings);
    this.loaded.set(true);
    document.title = settings.appTitle;
    this.scheduleWarningExpiration();
  }

  private scheduleWarningExpiration(): void {
    if (this.warningExpirationTimer) {
      clearTimeout(this.warningExpirationTimer);
      this.warningExpirationTimer = null;
    }
    const settings = this.settings();
    const expiresAt = settings.globalWarningExpiresAt
      ? Date.parse(settings.globalWarningExpiresAt)
      : null;
    if (
      !settings.globalWarningText ||
      (expiresAt !== null && (!Number.isFinite(expiresAt) || expiresAt <= Date.now()))
    ) {
      this.activeWarningText.set(null);
      return;
    }
    this.activeWarningText.set(settings.globalWarningText);
    if (expiresAt === null) {
      return;
    }
    this.warningExpirationTimer = setTimeout(
      () => this.scheduleWarningExpiration(),
      Math.min(MAX_TIMER_DELAY_MS, Math.max(1, expiresAt - Date.now()))
    );
  }

  private describeError(error: unknown): string {
    if (this.api.isApiError(error)) {
      return error.message;
    }
    return error instanceof Error ? error.message : "Application settings request failed.";
  }
}
