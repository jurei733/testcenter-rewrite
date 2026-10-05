import { Injectable, inject, signal } from "@angular/core";

import {
  parseParticipantEventStreamEvent,
  productionApiRoutes,
  resolveRoutePath,
  type ParticipantEventStreamEvent
} from "@testcenter-rewrite-app/contracts";

import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";
import { readParticipantSessionCredential } from "./participant-access-credentials";
import { createEventStreamWatchdog } from "./event-stream-watchdog";
import { createParticipantEventAcknowledgements } from "./participant-event-acknowledgements";
import { withSelectedParticipantRun } from "./participant-session-links";

type ParticipantRefresh = () => Promise<void>;
type ParticipantConnectionModeChange = (
  mode: "WEBSOCKET" | "POLLING"
) => void;

export type ParticipantEventStreamConnectionStatus =
  | "idle"
  | "connecting"
  | "live"
  | "reconnecting"
  | "offline";

export interface ParticipantEventStreamConnectionState {
  status: ParticipantEventStreamConnectionStatus;
  detail: string;
}

@Injectable({ providedIn: "root" })
export class ParticipantEventStreamService {
  private readonly uiState = inject(RewriteAppUiStateService);
  private abortController: AbortController | null = null;
  private connectHandle: number | null = null;
  private activeParticipantSessionId = "";
  private activeTestRunId = "";
  private generation = 0;
  private refreshRunning = false;
  private refreshPending = false;
  private refresh: ParticipantRefresh | null = null;
  private connectionModeChange: ParticipantConnectionModeChange | null = null;
  private lastReportedConnectionMode: "WEBSOCKET" | "POLLING" | null = null;
  private readonly connectionStateValue =
    signal<ParticipantEventStreamConnectionState>({
      status: "idle",
      detail: "Live participant updates are inactive."
    });

  readonly connectionState = this.connectionStateValue.asReadonly();

  start(
    participantSessionId: string,
    refresh: ParticipantRefresh,
    connectionModeChange: ParticipantConnectionModeChange | null = null,
    testRunId = ""
  ): void {
    const normalizedParticipantSessionId = participantSessionId.trim();
    const normalizedTestRunId = testRunId.trim();
    if (!normalizedParticipantSessionId) {
      this.stop();
      return;
    }

    this.refresh = refresh;
    this.connectionModeChange = connectionModeChange;
    if (
      this.activeParticipantSessionId === normalizedParticipantSessionId &&
      this.activeTestRunId === normalizedTestRunId &&
      (this.abortController || this.connectHandle != null)
    ) {
      return;
    }

    this.stopConnection();
    this.lastReportedConnectionMode = null;
    this.activeParticipantSessionId = normalizedParticipantSessionId;
    this.activeTestRunId = normalizedTestRunId;
    this.setConnectionState(
      "connecting",
      "Opening the live participant update channel."
    );
    this.generation += 1;
    const generation = this.generation;
    this.connectHandle = globalThis.window?.setTimeout(() => {
      this.connectHandle = null;
      void this.connect({
        generation,
        participantSessionId: normalizedParticipantSessionId,
        reconnecting: false
      });
    }, 1_000) ?? null;
  }

  stop(): void {
    this.stopConnection();
    this.activeParticipantSessionId = "";
    this.activeTestRunId = "";
    this.refresh = null;
    this.connectionModeChange = null;
    this.lastReportedConnectionMode = null;
    this.refreshPending = false;
    this.setConnectionState("idle", "Live participant updates are inactive.");
  }

  private stopConnection(): void {
    this.generation += 1;
    this.abortController?.abort();
    this.abortController = null;
    if (this.connectHandle != null) {
      globalThis.window?.clearTimeout(this.connectHandle);
      this.connectHandle = null;
    }
  }

  private async connect(input: {
    generation: number;
    participantSessionId: string;
    reconnecting: boolean;
  }): Promise<void> {
    if (input.generation !== this.generation) {
      return;
    }

    const controller = new AbortController();
    const watchdog = createEventStreamWatchdog(controller);
    let acknowledgementFailed = false;
    const acknowledge = createParticipantEventAcknowledgements(controller, input.participantSessionId, () => {
      acknowledgementFailed = true;
      controller.abort();
    });
    this.abortController = controller;
    if (input.reconnecting) {
      this.setConnectionState(
        "reconnecting",
        "Reconnecting the live participant update channel."
      );
    }
    try {
      const sessionToken = readParticipantSessionCredential(input.participantSessionId);
      const response = await fetch(
        withSelectedParticipantRun(resolveRoutePath(productionApiRoutes.participant.eventStream, {
          participantSessionId: input.participantSessionId
        }), this.activeTestRunId),
        {
          method: "GET",
          headers: {
            accept: "text/event-stream",
            ...(sessionToken ? { authorization: `Bearer ${sessionToken}` } : {})
          },
          cache: "no-store",
          signal: controller.signal
        }
      );
      if (input.generation !== this.generation) return;
      if (!response.ok || !response.body) {
        throw new Error(`Participant channel returned HTTP ${response.status}.`);
      }
      if (
        !(response.headers.get("content-type") ?? "").includes(
          "text/event-stream"
        )
      ) {
        throw new Error("Participant channel returned an unexpected content type.");
      }

      this.setConnectionState(
        "live",
        "Live participant updates are connected."
      );
      await this.consume(response.body, input.generation, watchdog.receivedEvent, acknowledge);
      if (input.generation === this.generation) {
        throw new Error("Participant channel closed.");
      }
    } catch {
      if (
        (controller.signal.aborted && !watchdog.timedOut && !acknowledgementFailed) ||
        input.generation !== this.generation
      ) {
        return;
      }
      // A failed persistent channel degrades to one quiet state refresh per
      // reconnect interval until streaming becomes available again.
      const offline =
        typeof navigator !== "undefined" && !navigator.onLine;
      this.setConnectionState(
        offline ? "offline" : "reconnecting",
        offline
          ? "The network is unavailable. Live updates reconnect automatically when the device is online."
          : "Live updates are temporarily unavailable. Reconnecting automatically; queued answers keep their retry protection."
      );
      this.queueRefresh();
      this.connectHandle = globalThis.window?.setTimeout(() => {
        this.connectHandle = null;
        void this.connect({ ...input, reconnecting: true });
      }, 3_000) ?? null;
    } finally {
      watchdog.stop();
    }
  }

  private async consume(
    stream: ReadableStream<Uint8Array>,
    generation: number,
    receivedEvent: () => void,
    acknowledge: (event: ParticipantEventStreamEvent) => void
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
          if (this.handleFrame(frame, generation, acknowledge)) receivedEvent();
          match = /\r?\n\r?\n/.exec(buffer);
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private handleFrame(frame: string, generation: number,
    acknowledge: (event: ParticipantEventStreamEvent) => void): boolean {
    if (generation !== this.generation) {
      return false;
    }
    const data = frame
      .split(/\r?\n/)
      .filter(line => line.startsWith("data:"))
      .map(line => line.slice("data:".length).trimStart())
      .join("\n");
    if (!data) {
      return false;
    }

    let event: ParticipantEventStreamEvent | null = null;
    try {
      event = parseParticipantEventStreamEvent(JSON.parse(data));
    } catch {
      return false;
    }
    if (!event || event.participantSessionId !== this.activeParticipantSessionId ||
      this.activeTestRunId && event.testRunId !== this.activeTestRunId) {
      return false;
    }
    acknowledge(event);
    this.setConnectionState(
      "live",
      `Live participant updates are connected; ${event.eventType} #${event.sequence}.`
    );
    if (event.eventType === "snapshot" || event.eventType === "change") {
      this.queueRefresh();
    }
    return true;
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

  private setConnectionState(
    status: ParticipantEventStreamConnectionStatus,
    detail: string
  ): void {
    const current = this.connectionStateValue();
    if (current.status === status && current.detail === detail) {
      return;
    }
    this.connectionStateValue.set({ status, detail });
    this.uiState.renderVersion.update(version => version + 1);
    const mode =
      status === "live"
        ? "WEBSOCKET"
        : status === "reconnecting" || status === "offline"
          ? "POLLING"
          : null;
    if (mode && mode !== this.lastReportedConnectionMode) {
      this.lastReportedConnectionMode = mode;
      this.connectionModeChange?.(mode);
    }
  }
}
