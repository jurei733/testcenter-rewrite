import { Injectable, signal } from "@angular/core";

import {
  assessBrowserCompatibility,
  resolveAndFormatParticipantCustomText
} from "@testcenter-rewrite-app/contracts";

@Injectable({ providedIn: "root" })
export class BrowserCompatibilityService {
  private readonly compatibility = globalThis.navigator?.userAgent
    ? assessBrowserCompatibility(globalThis.navigator.userAgent)
    : null;
  private readonly dismissed = signal(false);
  private readonly customTexts = signal<Readonly<Record<string, string>>>({});

  get warning(): { browser: string; version: string; message: string } | null {
    if (!this.compatibility || this.compatibility.supported || this.dismissed()) {
      return null;
    }
    const { family, version } = this.compatibility.browser;
    return {
      browser: family,
      version,
      message: resolveAndFormatParticipantCustomText(
        this.customTexts(),
        "login_unsupportedBrowserBanner",
        [family, version]
      )
    };
  }

  setCustomTexts(customTexts: Readonly<Record<string, string>>): void {
    this.customTexts.set(customTexts);
  }

  dismiss(): void {
    this.dismissed.set(true);
  }
}
