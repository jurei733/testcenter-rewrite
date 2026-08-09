import { ApplicationRef, Injectable, inject } from "@angular/core";

import {
  parseParticipantEventStreamEvent,
  productionApiRoutes,
  resolveRoutePath,
  type ParticipantEventStreamEvent
} from "@testcenter-rewrite-app/contracts";

import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

type ParticipantRefresh = () => Promise<void>;

@Injectable({ providedIn: "root" })
export class ParticipantEventStreamService {
  private readonly applicationRef = inject(ApplicationRef);
  private readonly uiState = inject(RewriteAppUiStateService);
  private abortController: AbortController | null = null;
  private connectHandle: number | null = null;
  private activeParticipantSessionId = "";
  private generation = 0;
  private refreshRunning = false;
  private refreshPending = false;
  private refresh: ParticipantRefresh | null = null;

  start(
    participantSessionId: string,
    refresh: ParticipantRefresh
  ): void {
    const normalizedParticipantSessionId = participantSessionId.trim();
    if (!normalizedParticipantSessionId) {
      this.stop();
      return;
    }

    this.refresh = refresh;
    if (
      this.activeParticipantSessionId === normalizedParticipantSessionId &&
      (this.abortController || this.connectHandle != null)
    ) {
      return;
    }

    this.stopConnection();
    this.activeParticipantSessionId = normalizedParticipantSessionId;
    this.generation += 1;
    const generation = this.generation;
    this.connectHandle = globalThis.window?.setTimeout(() => {
      this.connectHandle = null;
      void this.connect({
        generation,
        participantSessionId: normalizedParticipantSessionId
      });
    }, 1_000) ?? null;
  }

  stop(): void {
    this.stopConnection();
    this.activeParticipantSessionId = "";
    this.refresh = null;
    this.refreshPending = false;
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
  }): Promise<void> {
    if (input.generation !== this.generation) {
      return;
    }

    const controller = new AbortController();
    this.abortController = controller;
    try {
      const response = await fetch(
        resolveRoutePath(productionApiRoutes.participant.eventStream, {
          participantSessionId: input.participantSessionId
        }),
        {
          method: "GET",
          headers: { accept: "text/event-stream" },
          cache: "no-store",
          signal: controller.signal
        }
      );
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

      await this.consume(response.body, input.generation);
      if (input.generation === this.generation) {
        throw new Error("Participant channel closed.");
      }
    } catch {
      if (
        controller.signal.aborted ||
        input.generation !== this.generation
      ) {
        return;
      }
      // A failed persistent channel degrades to one quiet state refresh per
      // reconnect interval until streaming becomes available again.
      this.queueRefresh();
      this.connectHandle = globalThis.window?.setTimeout(() => {
        this.connectHandle = null;
        void this.connect(input);
      }, 3_000) ?? null;
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

    let event: ParticipantEventStreamEvent | null = null;
    try {
      event = parseParticipantEventStreamEvent(JSON.parse(data));
    } catch {
      return;
    }
    if (!event || event.participantSessionId !== this.activeParticipantSessionId) {
      return;
    }
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
        this.applicationRef.tick();
        if (this.refreshPending) {
          this.refreshPending = false;
          this.queueRefresh();
        }
      });
  }
}
