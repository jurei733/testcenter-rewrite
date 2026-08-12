import { Injectable, inject } from "@angular/core";

import {
  parseMonitorEventStreamEvent,
  productionApiRoutes,
  resolveRoutePath,
  type MonitorEventStreamEvent
} from "@testcenter-rewrite-app/contracts";

import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

type MonitorRefresh = () => Promise<void>;

@Injectable({ providedIn: "root" })
export class MonitorEventStreamService {
  private readonly uiState = inject(RewriteAppUiStateService);
  private abortController: AbortController | null = null;
  private reconnectHandle: number | null = null;
  private activeSignature = "";
  private generation = 0;
  private refreshRunning = false;
  private refreshPending = false;
  private refresh: MonitorRefresh | null = null;

  start(refresh: MonitorRefresh): void {
    const tenantKey = this.uiState.workspace.tenantKey.trim();
    const workspaceKey = this.uiState.workspace.workspaceKey.trim();
    const sessionToken = this.uiState.ops.adminSessionToken.trim();
    if (!tenantKey || !workspaceKey) {
      this.stop("Waiting for a tenant and workspace scope.");
      return;
    }

    const signature = `${tenantKey}\n${workspaceKey}\n${sessionToken}`;
    this.refresh = refresh;
    if (this.activeSignature === signature && this.abortController) {
      return;
    }

    this.stopConnection();
    this.activeSignature = signature;
    this.generation += 1;
    void this.connect({
      generation: this.generation,
      tenantKey,
      workspaceKey,
      sessionToken,
      reconnecting: false
    });
  }

  restart(refresh: MonitorRefresh): void {
    this.activeSignature = "";
    this.start(refresh);
  }

  stop(detail = "Live monitor is inactive outside the Runtime view."): void {
    this.stopConnection();
    this.activeSignature = "";
    this.refresh = null;
    this.setState("idle", detail);
  }

  private stopConnection(): void {
    this.generation += 1;
    this.abortController?.abort();
    this.abortController = null;
    if (this.reconnectHandle != null) {
      window.clearTimeout(this.reconnectHandle);
      this.reconnectHandle = null;
    }
  }

  private async connect(input: {
    generation: number;
    tenantKey: string;
    workspaceKey: string;
    sessionToken: string;
    reconnecting: boolean;
  }): Promise<void> {
    if (input.generation !== this.generation) {
      return;
    }

    const controller = new AbortController();
    this.abortController = controller;
    this.setState(
      input.reconnecting ? "reconnecting" : "connecting",
      input.reconnecting
        ? "Reconnecting the authenticated monitor channel."
        : "Opening the authenticated monitor channel."
    );

    try {
      const path = resolveRoutePath(productionApiRoutes.monitor.eventStream, {
        tenantKey: input.tenantKey,
        workspaceKey: input.workspaceKey
      });
      const response = await fetch(path, {
        method: "GET",
        headers: {
          accept: "text/event-stream",
          ...(input.sessionToken
            ? { authorization: `Bearer ${input.sessionToken}` }
            : {})
        },
        cache: "no-store",
        signal: controller.signal
      });
      if (!response.ok || !response.body) {
        throw new Error(`Monitor channel returned HTTP ${response.status}.`);
      }
      if (
        !(response.headers.get("content-type") ?? "").includes(
          "text/event-stream"
        )
      ) {
        throw new Error("Monitor channel returned an unexpected content type.");
      }

      this.setState("live", "Connected; waiting for the first monitor snapshot.");
      await this.consume(response.body, input.generation);
      if (input.generation === this.generation) {
        throw new Error("Monitor channel closed.");
      }
    } catch (error) {
      if (
        controller.signal.aborted ||
        input.generation !== this.generation
      ) {
        return;
      }
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      this.setState(
        offline ? "offline" : "polling",
        offline
          ? "Network unavailable; the monitor will reconnect automatically."
          : `${error instanceof Error ? error.message : "Monitor channel unavailable"} Using polling until reconnect.`
      );
      this.queueRefresh();
      this.reconnectHandle = window.setTimeout(() => {
        this.reconnectHandle = null;
        void this.connect({ ...input, reconnecting: true });
      }, 3_000);
    }
  }

  private async consume(
    stream: ReadableStream<Uint8Array>,
    generation: number
  ): Promise<void> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (generation === this.generation) {
        const chunk = await reader.read();
        if (chunk.done) {
          return;
        }
        buffer += decoder.decode(chunk.value, { stream: true });
        let match = /\r?\n\r?\n/.exec(buffer);
        while (match?.index != null) {
          const frame = buffer.slice(0, match.index);
          buffer = buffer.slice(match.index + match[0].length);
          this.handleFrame(frame, generation);
          match = /\r?\n\r?\n/.exec(buffer);
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private handleFrame(frame: string, generation: number): void {
    if (generation !== this.generation) {
      return;
    }
    const data = frame
      .split(/\r?\n/)
      .filter(line => line.startsWith("data:"))
      .map(line => line.slice("data:".length).trimStart())
      .join("\n");
    if (!data) {
      return;
    }

    let event: MonitorEventStreamEvent | null = null;
    try {
      event = parseMonitorEventStreamEvent(JSON.parse(data));
    } catch {
      return;
    }
    if (!event) {
      return;
    }

    this.uiState.runtime.monitorConnectionLastEventAt = event.emittedAt;
    this.uiState.runtime.monitorConnectionOpenRunCount = event.openRunCount;
    this.setState(
      "live",
      `${event.openRunCount} open run${event.openRunCount === 1 ? "" : "s"}; ${event.eventType} #${event.sequence}.`
    );
    if (event.eventType === "snapshot" || event.eventType === "change") {
      this.queueRefresh();
    }
  }

  private queueRefresh(): void {
    if (!this.refresh) {
      return;
    }
    if (this.refreshRunning) {
      this.refreshPending = true;
      return;
    }

    this.refreshRunning = true;
    void this.refresh()
      .catch(() => undefined)
      .finally(() => {
        this.refreshRunning = false;
        this.uiState.renderVersion.update(version => version + 1);
        if (this.refreshPending) {
          this.refreshPending = false;
          this.queueRefresh();
        }
      });
  }

  private setState(
    status: typeof this.uiState.runtime.monitorConnectionStatus,
    detail: string
  ): void {
    this.uiState.runtime.monitorConnectionStatus = status;
    this.uiState.runtime.monitorConnectionDetail = detail;
    this.uiState.renderVersion.update(version => version + 1);
  }
}
