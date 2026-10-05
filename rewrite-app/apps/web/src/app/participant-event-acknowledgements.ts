import { productionApiRoutes, resolveRoutePath, type ParticipantEventStreamEvent } from "@testcenter-rewrite-app/contracts";
import { readParticipantSessionCredential } from "./participant-access-credentials";

/** A sent server heartbeat is not presence: only a received, scoped frame is acknowledged. */
export const createParticipantEventAcknowledgements = (
  streamController: AbortController, participantSessionId: string, failed: () => void
): ((event: ParticipantEventStreamEvent) => void) => {
  let pending = false;
  let lastAcknowledgedKey = "";
  let lastAcknowledgedAt = 0;
  const monotonicNow = () => globalThis.performance?.now() ?? Date.now();
  return event => {
    if (!event.connectionId || event.participantSessionId !== participantSessionId ||
        streamController.signal.aborted || pending) return;
    const key = `${event.testRunId}:${event.connectionId}`;
    if (key === lastAcknowledgedKey && monotonicNow() - lastAcknowledgedAt < 10_000) return;
    pending = true;
    const controller = new AbortController();
    const abort = () => controller.abort();
    streamController.signal.addEventListener("abort", abort, { once: true });
    const timeout = globalThis.setTimeout(() => controller.abort(), 5_000);
    const token = readParticipantSessionCredential(participantSessionId);
    void fetch(resolveRoutePath(productionApiRoutes.participant.acknowledgeEventStream, { participantSessionId }), {
      method: "POST", cache: "no-store", signal: controller.signal,
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ testRunId: event.testRunId, connectionId: event.connectionId })
    }).then(response => {
      if (!response.ok) throw new Error("Participant live acknowledgement was rejected.");
      lastAcknowledgedKey = key;
      lastAcknowledgedAt = monotonicNow();
    }).catch(() => {
      if (!streamController.signal.aborted) failed();
    }).finally(() => {
      globalThis.clearTimeout(timeout);
      streamController.signal.removeEventListener("abort", abort);
      pending = false;
    });
  };
};
