import { isDeepStrictEqual } from "node:util";

const validClock = value => Number.isSafeInteger(value) && value >= 0;
const clockMap = value => value && typeof value === "object" && !Array.isArray(value) &&
  Object.values(value).every(group => validClock(group) || group && typeof group === "object" &&
    !Array.isArray(group) && Object.values(group).every(validClock));

/**
 * Inactive Unit saves remain byte-exact. An active Player can re-report any
 * restored part, advancing its capture clocks while preserving the payload.
 * Never normalize dataPart strings; only validated capture clocks may change.
 */
export function matchesVeronaSavedResponse(actual, expected, activePlayer = false) {
  if (typeof actual !== "string" || typeof expected !== "string") return false;
  if (actual === expected) return true;
  if (!activePlayer) return false;
  try {
    const actualEnvelope = JSON.parse(actual);
    const expectedEnvelope = JSON.parse(expected);
    if (actualEnvelope?.kind !== "verona_unit_state" || expectedEnvelope?.kind !== "verona_unit_state") return false;
    const { fieldTimestamps: actualClocks, ...actualState } = actualEnvelope;
    const { fieldTimestamps: expectedClocks, ...expectedState } = expectedEnvelope;
    if (!isDeepStrictEqual(actualState, expectedState)) return false;
    if (expectedClocks === undefined) return actualClocks === undefined || Boolean(clockMap(actualClocks));
    if (!clockMap(expectedClocks) || !clockMap(actualClocks)) return false;
    return Object.entries(expectedClocks).every(([group, fields]) => validClock(fields)
      ? validClock(actualClocks[group]) && actualClocks[group] >= fields
      : actualClocks[group] && typeof actualClocks[group] === "object" && !Array.isArray(actualClocks[group]) &&
        Object.entries(fields).every(([key, clock]) => validClock(actualClocks[group][key]) && actualClocks[group][key] >= clock));
  } catch {
    return false;
  }
}
