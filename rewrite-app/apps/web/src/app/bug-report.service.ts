import { Injectable, inject, signal } from "@angular/core";

import {
  buildBugReportText,
  productionApiRoutes,
  type BugReportConfigResponse,
  type SubmitBugReportResponse
} from "@testcenter-rewrite-app/contracts";

import { RewriteAppApiService } from "./rewrite-app-api.service";

type BugReportStatus =
  | { kind: "idle"; message: "" }
  | { kind: "working" | "success" | "error"; message: string };

@Injectable({ providedIn: "root" })
export class BugReportService {
  readonly isOpen = signal(false);
  readonly reportText = signal("");
  readonly config = signal<BugReportConfigResponse>({
    enabled: false,
    target: null
  });
  readonly status = signal<BugReportStatus>({ kind: "idle", message: "" });
  readonly issueUrl = signal<string | null>(null);

  private readonly api = inject(RewriteAppApiService);
  private readonly previousErrors: string[] = [];

  constructor() {
    void this.loadConfig();
  }

  async loadConfig(): Promise<void> {
    try {
      const { payload } = await this.api.send<BugReportConfigResponse>(
        "GET",
        productionApiRoutes.system.getBugReportConfig
      );
      this.config.set(payload);
    } catch {
      this.config.set({ enabled: false, target: null });
    }
  }

  capture(error: unknown, buildRef?: string | null): void {
    const normalized = this.normalizeError(error);
    this.openReport({
      label: normalized.label,
      message: normalized.message,
      stack: normalized.stack,
      buildRef
    });
  }

  openForMessage(message: string, buildRef?: string | null): void {
    this.openReport({
      label: "ApplicationError",
      message,
      stack: null,
      buildRef
    });
  }

  close(): void {
    this.isOpen.set(false);
  }

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.reportText());
      this.status.set({ kind: "success", message: "Fehlerbericht kopiert." });
    } catch {
      this.status.set({
        kind: "error",
        message: "Der Fehlerbericht konnte nicht kopiert werden. Bitte herunterladen."
      });
    }
  }

  download(): void {
    const objectUrl = URL.createObjectURL(
      new Blob([this.reportText()], { type: "text/plain;charset=utf-8" })
    );
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = "bug-report.txt";
    link.click();
    URL.revokeObjectURL(objectUrl);
    this.status.set({
      kind: "success",
      message: "Fehlerbericht heruntergeladen."
    });
  }

  async submit(): Promise<void> {
    if (!this.config().enabled || this.status().kind === "working") {
      return;
    }
    this.status.set({ kind: "working", message: "Fehlerbericht wird gesendet …" });
    this.issueUrl.set(null);
    try {
      const { payload } = await this.api.send<SubmitBugReportResponse>(
        "POST",
        productionApiRoutes.system.submitBugReport,
        {
          title: `Testcenter runtime error ${this.readErrorId()}`,
          tag: "Runtime Error",
          report: this.reportText()
        }
      );
      this.issueUrl.set(payload.issueUrl);
      this.status.set({ kind: "success", message: payload.message });
    } catch (error) {
      this.status.set({
        kind: "error",
        message: this.api.isApiError(error)
          ? error.message
          : "Der Fehlerbericht konnte nicht gesendet werden. Bitte herunterladen."
      });
    }
  }

  private openReport(input: {
    label: string;
    message: string;
    stack: string | null;
    buildRef?: string | null;
  }): void {
    const errorId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`;
    this.reportText.set(
      buildBugReportText({
        errorId,
        label: input.label,
        message: input.message,
        timestamp: new Date().toISOString(),
        url: globalThis.location?.href ?? "unknown",
        userAgent: globalThis.navigator?.userAgent ?? "unknown",
        buildRef: input.buildRef,
        stack: input.stack,
        previousErrors: this.previousErrors
      })
    );
    this.previousErrors.push(`${input.label}: ${input.message}`);
    if (this.previousErrors.length > 5) {
      this.previousErrors.shift();
    }
    this.issueUrl.set(null);
    this.status.set({ kind: "idle", message: "" });
    this.isOpen.set(true);
  }

  private readErrorId(): string {
    return /^Error ID: (.+)$/m.exec(this.reportText())?.[1] ?? "unknown";
  }

  private normalizeError(error: unknown): {
    label: string;
    message: string;
    stack: string | null;
  } {
    if (error instanceof Error) {
      return {
        label: error.name || "Error",
        message: error.message || String(error),
        stack: error.stack ?? null
      };
    }
    let message: string;
    try {
      message = typeof error === "string"
        ? error
        : JSON.stringify(error) || String(error);
    } catch {
      message = String(error);
    }
    return {
      label: "UnhandledError",
      message,
      stack: null
    };
  }
}
