import type { ParticipantTestLogEntryInput } from "@testcenter-rewrite-app/domain";
import type { ParticipantSaveOutboxEntry } from "./participant-save-outbox";

export function identifyParticipantTestLogEntries(
  entries: readonly ParticipantTestLogEntryInput[]
): ParticipantTestLogEntryInput[] {
  return entries.map(entry => ({
    ...entry,
    clientEntryId: entry.clientEntryId ??
      globalThis.crypto?.randomUUID?.() ??
      `entry-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  }));
}

export function carriedParticipantTestLogBatches(
  save: ParticipantSaveOutboxEntry | null
) {
  let index = 0;
  return save?.logs.map(batch => ({
    ...batch,
    entries: batch.entries.map(entry => {
      const logIndex = index++;
      return {
        ...entry,
        // Match the old server ID exactly when upgrading an existing outbox.
        clientEntryId: entry.clientEntryId ?? `${save.deliveryId}:log:${logIndex}`
      };
    })
  })) ?? [];
}
