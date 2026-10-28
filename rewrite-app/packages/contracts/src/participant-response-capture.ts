import type { ParticipantResponseFieldTimestamps } from "@testcenter-rewrite-app/domain";
import { mergeVeronaUnitResponse, parseVeronaUnitResponse, serializeVeronaUnitResponse } from "./verona-player.js";
import { captureParticipantResponseFieldTimestamps, nextParticipantResponseTimestamp,
  mergeParticipantResponseFieldTimestamps, normalizeParticipantResponseFieldTimestamps,
  readParticipantResponseFieldTimestamps } from "./participant-response-field-timestamps.js";

export const serializeCapturedVeronaUnitResponse = (input: Parameters<typeof serializeVeronaUnitResponse>[0] & {
  fieldTimestamps?: ParticipantResponseFieldTimestamps;
}): string => {
  const response = serializeVeronaUnitResponse(input);
  return input.fieldTimestamps === undefined ? response : JSON.stringify({ ...JSON.parse(response),
    fieldTimestamps: normalizeParticipantResponseFieldTimestamps(input.fieldTimestamps) });
};

export const parseCapturedVeronaUnitResponse = (value: string | null | undefined) => {
  const response = parseVeronaUnitResponse(value);
  if (!response) return null;
  const fieldTimestamps = readParticipantResponseFieldTimestamps(value);
  return { ...response, ...(fieldTimestamps === undefined ? {} : { fieldTimestamps }) };
};

/** Player-only capture path, loaded together with the lazy Player host. */
export const mergeCapturedVeronaUnitResponse = (previousValue: string | null | undefined,
  update: { unitState?: unknown; playerState?: unknown; captureTimestamp: number;
    storedFieldTimestamps?: ParticipantResponseFieldTimestamps }): string => {
  const previous = mergeParticipantResponseFieldTimestamps(
    readParticipantResponseFieldTimestamps(previousValue), update.storedFieldTimestamps);
  const fieldTimestamps = captureParticipantResponseFieldTimestamps(previous, update,
    nextParticipantResponseTimestamp(previous, update.captureTimestamp));
  // The legacy opaque barrier seeds the clock but remains scoped to the store.
  // Player envelopes carry independently captured fields, never that barrier.
  delete fieldTimestamps.opaque;
  return JSON.stringify({ ...JSON.parse(mergeVeronaUnitResponse(previousValue, update)), fieldTimestamps });
};
