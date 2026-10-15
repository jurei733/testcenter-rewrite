import type { ParticipantControllerDispatch } from "@testcenter-rewrite-app/domain";
import type { ParticipantSaveOutboxEntry } from "./participant-save-outbox";

export type ParticipantSaveBarrier = { deliveryIds: ReadonlySet<string>; wait: () => Promise<void> };

/** HTTP acknowledgement and buffer ownership survive view/outbox reconciliation. */
export const createParticipantSaveBarriers = () => {
  const flights = new Map<string, { entry: ParticipantSaveOutboxEntry; promise: Promise<unknown> }>();
  const closed = new Map<string, ParticipantControllerDispatch | null>();
  const key = (entry: ParticipantSaveOutboxEntry): string => `${entry.testRunId}\u0000${entry.deliveryId}`;
  const snapshot = (entries: ParticipantSaveOutboxEntry[]): ParticipantSaveBarrier => {
    const promises = entries.flatMap(entry => { const flight = flights.get(key(entry)); return flight ? [flight.promise] : []; });
    return { deliveryIds: new Set(entries.map(entry => entry.deliveryId)), wait: async () => {
      const current = entries.flatMap(entry => { const flight = flights.get(key(entry)); return flight ? [flight.promise] : []; });
      // The drainer retains failed packets and owns retry/error presentation.
      // Settlement retries that durable work after these concrete requests end.
      await Promise.allSettled([...promises, ...current]);
    } };
  };
  return {
    track(entry: ParticipantSaveOutboxEntry, promise: Promise<unknown>): void {
      const id = key(entry), flight = { entry, promise }; flights.set(id, flight);
      void promise.finally(() => { if (flights.get(id) === flight) flights.delete(id); }).catch(() => {});
    },
    active(testRunId: string): ParticipantSaveBarrier {
      return snapshot([...flights.values()].filter(flight => flight.entry.testRunId === testRunId).map(flight => flight.entry));
    },
    entries(testRunId: string): ParticipantSaveOutboxEntry[] {
      return [...flights.values()].filter(flight => flight.entry.testRunId === testRunId).map(flight => flight.entry);
    },
    close(entries: ParticipantSaveOutboxEntry[], dispatch?: ParticipantControllerDispatch): ParticipantSaveBarrier {
      const live = new Set([...entries.map(key), ...flights.keys()]);
      for (const id of closed.keys()) if (!live.has(id)) closed.delete(id);
      const owned = entries.filter(entry => {
        const id = key(entry), previous = closed.get(id);
        if (closed.has(id) && (!dispatch || !previous || previous.controllerId !== dispatch.controllerId || previous.sequence < dispatch.sequence)) return false;
        closed.set(id, dispatch ? { ...dispatch } : null); return true;
      });
      return snapshot(owned);
    }
  };
};
