import { Injectable, inject, signal } from "@angular/core";

import type {
  GetApplicationSettingsResponse,
  UpdateApplicationSettingsRequest,
  UpdateApplicationSettingsResponse
} from "@testcenter-rewrite-app/contracts";
import { productionApiRoutes } from "@testcenter-rewrite-app/contracts";
import {
  defaultApplicationSettings,
  type ApplicationAssetSlotName,
  type ApplicationSettings
} from "@testcenter-rewrite-app/domain";

import { RewriteAppApiService } from "./rewrite-app-api.service";

const MAX_TIMER_DELAY_MS = 2_147_000_000;

const defaultApplicationAssetNames: Record<ApplicationAssetSlotName, string> = {
  logo: "IQB-Logo-2025.png",
  loginIllustration: "login-illustration.png",
  codeInputIllustration: "code-input-illustration-kids.png",
  codeInputCompanion: "bird-character.png",
  starterCompanion: "bird-character-cool.png",
  starterCardDone: "bird-character-done.png",
  loadingProgress: "bird-character-cool.png",
  confirmDialog: "bird-character-cool.png"
};

@Injectable({ providedIn: "root" })
export class ApplicationSettingsService {
  private readonly api = inject(RewriteAppApiService);
  private warningExpirationTimer: ReturnType<typeof setTimeout> | null = null;
  private participantThemeOverride: ApplicationSettings["themeName"] | null = null;
  private participantAssetOverrides: Record<string, string> = {};

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

  applyParticipantTheme(theme?: string | null): void {
    this.participantThemeOverride =
      theme === "Primar" || theme === "Sekundar" || theme === "Erwachsene"
        ? theme
        : null;
    this.syncDocumentTheme();
  }

  clearParticipantTheme(): void {
    this.participantThemeOverride = null;
    this.syncDocumentTheme();
  }

  applyParticipantAssets(assetAssignments?: Record<string, string> | null): void {
    this.participantAssetOverrides = { ...(assetAssignments ?? {}) };
  }

  assetUrl(
    slot: ApplicationAssetSlotName,
    fallback = ""
  ): string {
    const originalName =
      this.participantAssetOverrides[slot] ??
      this.settings().assetAssignments[slot];
    if (originalName) {
      return `${productionApiRoutes.system.getApplicationAsset}?originalName=${encodeURIComponent(originalName)}`;
    }
    if (
      slot === "logo" &&
      fallback &&
      fallback !== defaultApplicationSettings.mainLogo
    ) {
      return fallback;
    }
    const themeName =
      this.participantThemeOverride ?? this.settings().themeName;
    const assetName =
      themeName === "Sekundar" && slot === "codeInputIllustration"
        ? "code-input-illustration-teens.png"
        : defaultApplicationAssetNames[slot];
    return `assets/images/${assetName}`;
  }

  applicationAssetUrl(originalName: string): string {
    return `${productionApiRoutes.system.getApplicationAsset}?originalName=${encodeURIComponent(originalName)}`;
  }

  private apply(settings: ApplicationSettings): void {
    this.settings.set({ ...settings, assetAssignments: settings.assetAssignments ?? {} });
    this.loaded.set(true);
    document.title = settings.appTitle;
    this.syncDocumentTheme();
    this.scheduleWarningExpiration();
  }

  private syncDocumentTheme(): void {
    document.documentElement.dataset["applicationTheme"] =
      this.participantThemeOverride ?? this.settings().themeName;
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
