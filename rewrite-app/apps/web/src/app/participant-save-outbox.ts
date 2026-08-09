import type { ParticipantTestLogEntryInput } from "@testcenter-rewrite-app/domain";

import {
  discardParticipantBackgroundSavesForRun,
  queueParticipantSaveForBackgroundDelivery,
  removeParticipantSaveFromBackgroundDelivery
} from "./participant-save-background-sync";

export const PARTICIPANT_SAVE_OUTBOX_STORAGE_KEY =
  "testcenter-rewrite:participant-save-outbox:v1";

const OUTBOX_VERSION = 1 as const;
const MAX_OUTBOX_ENTRIES = 8;
const MAX_STORED_RESPONSE_CHARS = 4_000_000;
const MAX_STORED_DOCUMENT_CHARS = 4_500_000;

export type ParticipantSaveOutboxLogBatch = {
  unitKey: string | null;
  originalUnitId: string | null;
  entries: ParticipantTestLogEntryInput[];
};

export type ParticipantSaveOutboxEntry = {
  version: typeof OUTBOX_VERSION;
  deliveryId: string;
  testRunId: string;
  unitKey: string;
  response: string;
  status: "running" | "paused";
  logs: ParticipantSaveOutboxLogBatch[];
  queuedAt: string;
};

type ParticipantSaveOutboxDocument = {
  version: typeof OUTBOX_VERSION;
  entries: ParticipantSaveOutboxEntry[];
};

export function createParticipantSaveOutboxEntry(input: {
  testRunId: string;
  unitKey: string;
  response: string;
  status: "running" | "paused";
  logs: ParticipantSaveOutboxLogBatch[];
}): ParticipantSaveOutboxEntry {
  return {
    version: OUTBOX_VERSION,
    deliveryId: createDeliveryId(),
    testRunId: input.testRunId,
    unitKey: input.unitKey,
    response: input.response,
    status: input.status,
    logs: input.logs,
    queuedAt: new Date().toISOString()
  };
}

export function findParticipantSaveOutboxEntry(
  testRunId: string,
  storage = getBrowserStorage()
): ParticipantSaveOutboxEntry | null {
  return listParticipantSaveOutboxEntriesForRun(testRunId, storage)[0] ?? null;
}

export function findParticipantSaveOutboxEntryForUnit(
  testRunId: string,
  unitKey: string,
  storage = getBrowserStorage()
): ParticipantSaveOutboxEntry | null {
  return listParticipantSaveOutboxEntriesForRun(testRunId, storage).find(
    entry => entry.unitKey === unitKey
  ) ?? null;
}

export function listParticipantSaveOutboxEntriesForRun(
  testRunId: string,
  storage = getBrowserStorage()
): ParticipantSaveOutboxEntry[] {
  return readParticipantSaveOutbox(storage).filter(
    entry => entry.testRunId === testRunId
  );
}

export function persistParticipantSaveOutboxEntry(
  entry: ParticipantSaveOutboxEntry,
  storage = getBrowserStorage()
): boolean {
  if (!storage || !isParticipantSaveOutboxEntry(entry)) {
    return false;
  }
  const entries = [
    ...readParticipantSaveOutbox(storage).filter(
      candidate =>
        candidate.testRunId !== entry.testRunId ||
        candidate.unitKey !== entry.unitKey
    ),
    entry
  ]
    .sort((left, right) => left.queuedAt.localeCompare(right.queuedAt))
    .slice(-MAX_OUTBOX_ENTRIES);
  return writeParticipantSaveOutbox({ version: OUTBOX_VERSION, entries }, storage);
}

export function queueParticipantSaveOutboxEntryForBackgroundDelivery(
  entry: ParticipantSaveOutboxEntry,
  storage = getBrowserStorage()
): boolean {
  const persisted = persistParticipantSaveOutboxEntry(entry, storage);
  if (persisted) {
    queueParticipantSaveForBackgroundDelivery(entry);
  }
  return persisted;
}

export function queueParticipantSaveOutboxForRunForBackgroundDelivery(
  testRunId: string,
  storage = getBrowserStorage()
): number {
  const entries = listParticipantSaveOutboxEntriesForRun(testRunId, storage);
  for (const entry of entries) {
    queueParticipantSaveForBackgroundDelivery(entry);
  }
  return entries.length;
}

export function removeParticipantSaveOutboxEntry(
  testRunId: string,
  deliveryId: string,
  storage = getBrowserStorage()
): boolean {
  if (!storage) {
    return false;
  }
  const existing = readParticipantSaveOutbox(storage);
  const entries = existing.filter(
    entry =>
      entry.testRunId !== testRunId || entry.deliveryId !== deliveryId
  );
  if (entries.length === existing.length) {
    return true;
  }
  if (entries.length === 0) {
    try {
      storage.removeItem(PARTICIPANT_SAVE_OUTBOX_STORAGE_KEY);
      removeParticipantSaveFromBackgroundDelivery(testRunId, deliveryId);
      return true;
    } catch {
      return false;
    }
  }
  const removed = writeParticipantSaveOutbox(
    { version: OUTBOX_VERSION, entries },
    storage
  );
  if (removed) {
    removeParticipantSaveFromBackgroundDelivery(testRunId, deliveryId);
  }
  return removed;
}

export function discardParticipantSaveOutboxForRun(
  testRunId: string,
  storage = getBrowserStorage()
): boolean {
  if (!storage) {
    return false;
  }
  const existing = readParticipantSaveOutbox(storage);
  const entries = existing.filter(entry => entry.testRunId !== testRunId);
  if (entries.length === existing.length) {
    return true;
  }
  if (entries.length === 0) {
    try {
      storage.removeItem(PARTICIPANT_SAVE_OUTBOX_STORAGE_KEY);
      discardParticipantBackgroundSavesForRun(testRunId);
      return true;
    } catch {
      return false;
    }
  }
  const discarded = writeParticipantSaveOutbox(
    { version: OUTBOX_VERSION, entries },
    storage
  );
  if (discarded) {
    discardParticipantBackgroundSavesForRun(testRunId);
  }
  return discarded;
}

function readParticipantSaveOutbox(
  storage: Storage | null
): ParticipantSaveOutboxEntry[] {
  if (!storage) {
    return [];
  }
  try {
    const rawValue = storage.getItem(PARTICIPANT_SAVE_OUTBOX_STORAGE_KEY);
    if (!rawValue || rawValue.length > MAX_STORED_DOCUMENT_CHARS) {
      return [];
    }
    const document = JSON.parse(rawValue) as Partial<ParticipantSaveOutboxDocument>;
    if (document.version !== OUTBOX_VERSION || !Array.isArray(document.entries)) {
      return [];
    }
    return document.entries
      .filter(isParticipantSaveOutboxEntry)
      .sort((left, right) => left.queuedAt.localeCompare(right.queuedAt))
      .slice(-MAX_OUTBOX_ENTRIES);
  } catch {
    return [];
  }
}

function writeParticipantSaveOutbox(
  document: ParticipantSaveOutboxDocument,
  storage: Storage
): boolean {
  try {
    const serialized = JSON.stringify(document);
    if (serialized.length > MAX_STORED_DOCUMENT_CHARS) {
      return false;
    }
    storage.setItem(PARTICIPANT_SAVE_OUTBOX_STORAGE_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

function isParticipantSaveOutboxEntry(
  value: unknown
): value is ParticipantSaveOutboxEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const entry = value as Partial<ParticipantSaveOutboxEntry>;
  return (
    entry.version === OUTBOX_VERSION &&
    typeof entry.deliveryId === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(entry.deliveryId) &&
    isBoundedIdentifier(entry.testRunId) &&
    isBoundedIdentifier(entry.unitKey) &&
    typeof entry.response === "string" &&
    entry.response.length <= MAX_STORED_RESPONSE_CHARS &&
    (entry.status === "running" || entry.status === "paused") &&
    typeof entry.queuedAt === "string" &&
    Number.isFinite(Date.parse(entry.queuedAt)) &&
    isParticipantSaveOutboxLogs(entry.logs)
  );
}

function isParticipantSaveOutboxLogs(
  value: unknown
): value is ParticipantSaveOutboxLogBatch[] {
  if (!Array.isArray(value) || value.length > 20) {
    return false;
  }
  let entryCount = 0;
  return value.every(batch => {
    if (typeof batch !== "object" || batch === null) {
      return false;
    }
    const candidate = batch as Partial<ParticipantSaveOutboxLogBatch>;
    if (
      !isNullableBoundedIdentifier(candidate.unitKey) ||
      !isNullableBoundedIdentifier(candidate.originalUnitId) ||
      !Array.isArray(candidate.entries)
    ) {
      return false;
    }
    entryCount += candidate.entries.length;
    return entryCount <= 200 && candidate.entries.every(entry =>
      typeof entry === "object" &&
      entry !== null &&
      typeof entry.key === "string" &&
      entry.key.length > 0 &&
      entry.key.length <= 200 &&
      (entry.content === undefined ||
        (typeof entry.content === "string" && entry.content.length <= 32_768)) &&
      Number.isSafeInteger(entry.timeStamp) &&
      entry.timeStamp >= 0 &&
      entry.timeStamp <= 8_640_000_000_000_000
    );
  });
}

function isBoundedIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 500;
}

function isNullableBoundedIdentifier(
  value: unknown
): value is string | null {
  return value === null || isBoundedIdentifier(value);
}

function createDeliveryId(): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) {
    return randomUuid;
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function getBrowserStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
