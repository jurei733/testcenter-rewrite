import { Injectable, signal } from "@angular/core";

export type InterfaceMode = "rewrite" | "original";
const storageKey = "testcenter-interface-mode";

/** Presentation only: never writes the shared session or application settings. */
@Injectable({ providedIn: "root" })
export class InterfaceModeService {
  readonly mode = signal<InterfaceMode>("rewrite");

  constructor() {
    const parameter = new URLSearchParams(window.location.search).get("ui");
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(storageKey);
    } catch {
      // The explicit URL selection still works when browser storage is denied.
    }
    const selected = parameter === "original" || parameter === "rewrite"
      ? parameter
      : stored;
    this.select(selected === "original" ? "original" : "rewrite");
  }

  select(mode: InterfaceMode): void {
    this.mode.set(mode);
    document.documentElement.dataset["interfaceMode"] = mode;
    try {
      window.localStorage.setItem(storageKey, mode);
    } catch {
      // Storage must never be required to select or use an interface.
    }
    // An explicit switch supersedes a deep link's old selection on reload.
    const url = new URL(window.location.href);
    if (url.searchParams.has("ui")) {
      url.searchParams.set("ui", mode);
      window.history.replaceState(window.history.state, "", url);
    }
  }
}
