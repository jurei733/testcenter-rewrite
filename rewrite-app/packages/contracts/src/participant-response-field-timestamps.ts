import type { ParticipantResponseFieldTimestamps } from "@testcenter-rewrite-app/domain";

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
const groups = ["unitState", "dataParts", "playerState"] as const;
const validTimestamp = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export const normalizeParticipantResponseFieldTimestamps = (
  value: unknown
): ParticipantResponseFieldTimestamps => {
  if (value === undefined) return {};
  const input = record(value);
  if (!input || Object.keys(input).some(key => key !== "opaque" && !groups.includes(key as typeof groups[number]))) {
    throw new RangeError("Response field timestamps require named timestamp maps.");
  }
  const result: ParticipantResponseFieldTimestamps = {};
  for (const group of groups) {
    if (!Object.hasOwn(input, group) || input[group] === undefined) continue;
    const entries = record(input[group]);
    if (!entries || Object.values(entries).some(timestamp => !validTimestamp(timestamp))) {
      throw new RangeError("Response field timestamps must be non-negative safe integers.");
    }
    if (Object.keys(entries).length) result[group] = Object.fromEntries(Object.entries(entries)) as Record<string, number>;
  }
  if (Object.hasOwn(input, "opaque") && input.opaque !== undefined) {
    if (!validTimestamp(input.opaque)) throw new RangeError("Response field timestamps must be non-negative safe integers.");
    result.opaque = input.opaque;
  }
  return result;
};

/** Combine stored and locally captured clocks without changing either source. */
export const mergeParticipantResponseFieldTimestamps = (
  ...sources: Array<ParticipantResponseFieldTimestamps | undefined>
): ParticipantResponseFieldTimestamps => {
  const result: ParticipantResponseFieldTimestamps = {};
  for (const source of sources) {
    const normalized = normalizeParticipantResponseFieldTimestamps(source);
    for (const group of groups) {
      const fields = new Map(Object.entries(result[group] ?? {}));
      for (const [key, timestamp] of Object.entries(normalized[group] ?? {})) {
        fields.set(key, Math.max(fields.get(key) ?? 0, timestamp));
      }
      if (fields.size) result[group] = Object.fromEntries(fields);
    }
    if (normalized.opaque !== undefined) result.opaque = Math.max(result.opaque ?? 0, normalized.opaque);
  }
  return result;
};

/** Stamp only fields actually reported by this Player notification. */
export const captureParticipantResponseFieldTimestamps = (
  previous: ParticipantResponseFieldTimestamps | undefined,
  update: { unitState?: unknown; playerState?: unknown },
  timestamp: number
): ParticipantResponseFieldTimestamps => {
  if (!validTimestamp(timestamp) || timestamp === 0) throw new RangeError("A Player capture requires a positive timestamp.");
  const result = normalizeParticipantResponseFieldTimestamps(previous);
  const unitState = record(update.unitState);
  const fields = {
    unitState: unitState ? Object.fromEntries(Object.entries(unitState).filter(([key]) => key !== "dataParts")) : null,
    dataParts: record(unitState?.dataParts), playerState: record(update.playerState)
  };
  for (const group of groups) {
    if (!fields[group] || !Object.keys(fields[group]).length) continue;
    result[group] = { ...result[group], ...Object.fromEntries(Object.keys(fields[group]).map(key => [key, timestamp])) };
  }
  return result;
};

export const nextParticipantResponseTimestamp = (
  previous: ParticipantResponseFieldTimestamps | undefined, timestamp: number
): number => {
  const values = normalizeParticipantResponseFieldTimestamps(previous);
  const last = groups.reduce((maximum, group) => Object.values(values[group] ?? {}).reduce((last, timestamp) => Math.max(last, timestamp), maximum), values.opaque ?? 0);
  const next = Math.max(timestamp, last + 1);
  if (!validTimestamp(next) || next === 0) throw new RangeError("A Player capture requires a positive safe timestamp.");
  return next;
};


/** Untrusted ordering metadata is validated before answer data is reconciled. */
export const readParticipantResponseFieldTimestamps = (value: string | null | undefined): ParticipantResponseFieldTimestamps | undefined => {
  let parsed: Record<string, unknown> | null;
  try { parsed = value == null ? null : record(JSON.parse(value)); } catch { return undefined; }
  if (parsed?.kind !== "verona_unit_state" || parsed.version !== 1 || !Object.hasOwn(parsed, "fieldTimestamps")) return undefined;
  if (!record(parsed.unitState)) throw new RangeError("A timestamped Verona response requires a unit-state object.");
  return normalizeParticipantResponseFieldTimestamps(parsed.fieldTimestamps);
};
