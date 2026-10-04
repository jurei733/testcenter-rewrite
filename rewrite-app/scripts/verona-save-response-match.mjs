/**
 * Inactive Unit saves must remain byte-exact. An active Player can publish the
 * same complete envelope again without our synthetic outer whitespace marker.
 * Never normalize dataPart strings or discard fields from the envelope.
 */
export function matchesVeronaSavedResponse(actual, expected, activePlayer = false) {
  if (typeof actual !== "string" || typeof expected !== "string") return false;
  if (actual === expected) return true;
  if (!activePlayer) return false;
  try {
    const actualEnvelope = JSON.parse(actual);
    const expectedEnvelope = JSON.parse(expected);
    return actualEnvelope?.kind === "verona_unit_state" &&
      expectedEnvelope?.kind === "verona_unit_state" &&
      JSON.stringify(actualEnvelope) === JSON.stringify(expectedEnvelope);
  } catch {
    return false;
  }
}
