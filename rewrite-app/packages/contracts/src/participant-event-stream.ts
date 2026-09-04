export const PARTICIPANT_EVENT_STREAM_SCHEMA_VERSION = 1 as const;

export const participantEventStreamEventTypes = [
  "snapshot",
  "change",
  "heartbeat"
] as const;

export type ParticipantEventStreamEventType =
  (typeof participantEventStreamEventTypes)[number];

export type ParticipantEventStreamEvent = {
  schemaVersion: typeof PARTICIPANT_EVENT_STREAM_SCHEMA_VERSION;
  eventType: ParticipantEventStreamEventType;
  sequence: number;
  participantSessionId: string;
  testRunId: string;
  emittedAt: string;
  revision: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const parseParticipantEventStreamEvent = (
  value: unknown
): ParticipantEventStreamEvent | null => {
  if (!isRecord(value)) {
    return null;
  }

  const eventType = value.eventType;
  if (
    value.schemaVersion !== PARTICIPANT_EVENT_STREAM_SCHEMA_VERSION ||
    typeof eventType !== "string" ||
    !participantEventStreamEventTypes.includes(
      eventType as ParticipantEventStreamEventType
    ) ||
    typeof value.sequence !== "number" ||
    !Number.isSafeInteger(value.sequence) ||
    value.sequence < 1 ||
    typeof value.participantSessionId !== "string" ||
    !value.participantSessionId.trim() ||
    typeof value.testRunId !== "string" ||
    !value.testRunId.trim() ||
    typeof value.emittedAt !== "string" ||
    !Number.isFinite(Date.parse(value.emittedAt)) ||
    typeof value.revision !== "string" ||
    !/^[a-f0-9]{64}$/i.test(value.revision)
  ) {
    return null;
  }

  return {
    schemaVersion: PARTICIPANT_EVENT_STREAM_SCHEMA_VERSION,
    eventType: eventType as ParticipantEventStreamEventType,
    sequence: value.sequence,
    participantSessionId: value.participantSessionId,
    testRunId: value.testRunId,
    emittedAt: value.emittedAt,
    revision: value.revision.toLowerCase()
  };
};
