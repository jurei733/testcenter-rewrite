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
  private readonly customTexts = signal<Readonly<Record<string, string>>>({});

  get warning(): { browser: string; version: string; message: string } | null {
    if (!this.compatibility || this.compatibility.supported) {
      return null;
    }
    const { family, version } = this.compatibility.browser;
    return {
      browser: family,
      version,
      message: resolveAndFormatParticipantCustomText(
        this.customTexts(),
        "login_unsupportedBrowser",
        [family, version]
      )
    };
  }

  get originalWarning(): { browser: string; version: string; message: string } | null {
    const warning = this.warning;
    if (!warning) return null;
    // Original browserslist-useragent resolves a three-part semver. Keep the
    // raw identity and support decision unchanged; adapt only this label.
    const parts = warning.version.match(/^\d+(?:\.\d+)*/u)?.[0].split(".").slice(0, 3);
    const version = parts ? [...parts, "0", "0"].slice(0, 3).join(".") : warning.version;
    return { ...warning, version, message: resolveAndFormatParticipantCustomText(
      this.customTexts(), "login_unsupportedBrowser", [warning.browser, version]
    ) };
  }

  setCustomTexts(customTexts: Readonly<Record<string, string>>): void {
    this.customTexts.set(customTexts);
  }
}
