export const MONITOR_EVENT_STREAM_SCHEMA_VERSION = 1 as const;

export const monitorEventStreamEventTypes = [
  "snapshot",
  "change",
  "heartbeat"
] as const;

export type MonitorEventStreamEventType =
  (typeof monitorEventStreamEventTypes)[number];

export type MonitorEventStreamEvent = {
  schemaVersion: typeof MONITOR_EVENT_STREAM_SCHEMA_VERSION;
  eventType: MonitorEventStreamEventType;
  sequence: number;
  tenantKey: string;
  workspaceKey: string;
  emittedAt: string;
  revision: string;
  openRunCount: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const parseMonitorEventStreamEvent = (
  value: unknown
): MonitorEventStreamEvent | null => {
  if (!isRecord(value)) {
    return null;
  }

  const eventType = value.eventType;
  if (
    value.schemaVersion !== MONITOR_EVENT_STREAM_SCHEMA_VERSION ||
    typeof eventType !== "string" ||
    !monitorEventStreamEventTypes.includes(
      eventType as MonitorEventStreamEventType
    ) ||
    typeof value.sequence !== "number" ||
    !Number.isSafeInteger(value.sequence) ||
    value.sequence < 1 ||
    typeof value.tenantKey !== "string" ||
    !value.tenantKey.trim() ||
    typeof value.workspaceKey !== "string" ||
    !value.workspaceKey.trim() ||
    typeof value.emittedAt !== "string" ||
    !Number.isFinite(Date.parse(value.emittedAt)) ||
    typeof value.revision !== "string" ||
    !/^[a-f0-9]{64}$/i.test(value.revision) ||
    typeof value.openRunCount !== "number" ||
    !Number.isSafeInteger(value.openRunCount) ||
    value.openRunCount < 0
  ) {
    return null;
  }

  return {
    schemaVersion: MONITOR_EVENT_STREAM_SCHEMA_VERSION,
    eventType: eventType as MonitorEventStreamEventType,
    sequence: value.sequence,
    tenantKey: value.tenantKey,
    workspaceKey: value.workspaceKey,
    emittedAt: value.emittedAt,
    revision: value.revision.toLowerCase(),
    openRunCount: value.openRunCount
  };
};
