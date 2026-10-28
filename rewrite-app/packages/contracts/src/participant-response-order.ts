import { serializeCapturedVeronaUnitResponse as serializeVeronaUnitResponse } from "./participant-response-capture.js";
import type { ParticipantResponseFieldTimestamps } from "@testcenter-rewrite-app/domain";
import { parseVeronaUnitResponse } from "./verona-player.js";

import { normalizeParticipantResponseFieldTimestamps, readParticipantResponseFieldTimestamps } from "./participant-response-field-timestamps.js";

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
const groups = ["unitState", "dataParts", "playerState"] as const;
const validTimestamp = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) =>
  record(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);

const envelopeTimestamps = readParticipantResponseFieldTimestamps;

/** Source State::applyPatch and unit_data both accept only strictly newer fields. */
export const reconcileParticipantResponse = (input: {
  currentResponse: string | undefined;
  currentTimestamps?: ParticipantResponseFieldTimestamps;
  incomingResponse: string;
  incomingTimestamps?: ParticipantResponseFieldTimestamps;
  capturedAt: number;
}): { response: string; timestamps: ParticipantResponseFieldTimestamps; changed: boolean; acceptedFields: number } => {
  if (!validTimestamp(input.capturedAt) || input.capturedAt === 0) throw new RangeError("An answer capture requires a positive safe timestamp.");
  const oldEnvelopeClocks = envelopeTimestamps(input.currentResponse);
  const newEnvelopeClocks = envelopeTimestamps(input.incomingResponse);
  const previous = normalizeParticipantResponseFieldTimestamps(input.currentTimestamps ?? oldEnvelopeClocks);
  const incoming = normalizeParticipantResponseFieldTimestamps(input.incomingTimestamps ?? newEnvelopeClocks);
  const oldPacket = parseVeronaUnitResponse(input.currentResponse), newPacket = parseVeronaUnitResponse(input.incomingResponse);
  if (newEnvelopeClocks !== undefined && !newPacket) throw new RangeError("A timestamped Verona response requires a valid unit-state envelope.");
  const outcome = (response: string, timestamps: ParticipantResponseFieldTimestamps, acceptedFields: number) => ({
    response, timestamps, acceptedFields,
    changed: response !== input.currentResponse || canonical(timestamps) !== canonical(previous)
  });
  if (!newPacket) {
    const last = groups.reduce((maximum, group) => Object.values(previous[group] ?? {}).reduce((last, timestamp) => Math.max(last, timestamp), maximum), previous.opaque ?? 0);
    const timestamp = incoming.opaque ?? input.capturedAt;
    return timestamp > last ? outcome(input.incomingResponse, { opaque: timestamp }, 1)
      : outcome(input.currentResponse ?? "", previous, 0);
  }
  const values = {
    unitState: { ...oldPacket?.unitState },
    dataParts: { ...oldPacket?.unitState.dataParts },
    playerState: { ...oldPacket?.playerState }
  } as Record<typeof groups[number], Record<string, unknown>>;
  delete values.unitState.dataParts;
  const nextClocks = normalizeParticipantResponseFieldTimestamps(previous);
  const dataTypes = new Map(Object.entries(oldPacket?.dataPartValueTypes ?? {}));
  let accepted = 0;
  const fields = { unitState: newPacket.unitState, dataParts: newPacket.unitState.dataParts ?? {}, playerState: newPacket.playerState ?? {} };
  for (const group of groups) {
    const merged = new Map(Object.entries(values[group]));
    const clocks = new Map(Object.entries(previous[group] ?? {}));
    for (const [key, value] of Object.entries(fields[group])) {
      if (group === "unitState" && key === "dataParts") continue;
      const clockGroup = incoming[group];
      const timestamp = clockGroup && Object.hasOwn(clockGroup, key) ? clockGroup[key]! : incoming.opaque ??
        (newEnvelopeClocks !== undefined || input.incomingTimestamps !== undefined ? 0 : input.capturedAt);
      if (timestamp <= Math.max(clocks.get(key) ?? 0, previous.opaque ?? 0)) continue;
      merged.set(key, value); clocks.set(key, timestamp); accepted++;
      if (group === "dataParts") {
        const type = newPacket.dataPartValueTypes?.[key];
        if (type) dataTypes.set(key, type); else dataTypes.delete(key);
      }
    }
    values[group] = Object.fromEntries(merged);
    if (clocks.size) nextClocks[group] = Object.fromEntries(clocks);
  }
  if (!accepted) {
    const hasFields = Object.keys(fields.unitState).some(key => key !== "dataParts") ||
      Object.keys(fields.dataParts).length > 0 || Object.keys(fields.playerState).length > 0;
    const hasUnacceptedClocks = newEnvelopeClocks !== undefined && canonical(newEnvelopeClocks) !== canonical(previous);
    return outcome(input.currentResponse ?? (hasFields || hasUnacceptedClocks ? serializeVeronaUnitResponse({ unitState: {},
      ...(newEnvelopeClocks ? { fieldTimestamps: previous } : {}) }) : input.incomingResponse), previous, 0);
  }
  const serialized = serializeVeronaUnitResponse({
    unitState: { ...values.unitState, ...(Object.keys(values.dataParts).length ? { dataParts: values.dataParts } : {}) },
    dataPartValueTypes: dataTypes.size ? Object.fromEntries(dataTypes) : undefined,
    ...(oldPacket?.playerState || newPacket.playerState ? { playerState: values.playerState } : {}),
    ...(newEnvelopeClocks || oldEnvelopeClocks ? { fieldTimestamps: nextClocks } : {})
  });
  // Preserve the exact incoming bytes when merging did not retain other values.
  const combined = parseVeronaUnitResponse(serialized)!;
  // On opaque-to-Verona conversion the old barrier remains in the store sidecar.
  // Every accepted field is newer than that barrier, so its capture clock also
  // preserves the Player's monotonic clock on reload without rewriting the packet.
  const packetClocks = newEnvelopeClocks && !Object.hasOwn(newEnvelopeClocks, "opaque")
    ? Object.fromEntries(Object.entries(nextClocks).filter(([key]) => key !== "opaque")) : nextClocks;
  const comparable = newEnvelopeClocks ? { ...combined, fieldTimestamps: packetClocks } : combined;
  const candidate = newEnvelopeClocks ? { ...newPacket, fieldTimestamps: newEnvelopeClocks } : newPacket;
  const response = (!oldEnvelopeClocks || newEnvelopeClocks) && canonical(comparable) === canonical(candidate) ? input.incomingResponse : serialized;
  return outcome(response, nextClocks, accepted);
};
