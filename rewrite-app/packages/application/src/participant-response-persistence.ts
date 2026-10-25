import { nextParticipantResponseTimestamp, readParticipantResponseFieldTimestamps } from "@testcenter-rewrite-app/contracts/participant-response-field-timestamps";
import { reconcileParticipantResponse } from "@testcenter-rewrite-app/contracts/participant-response-order";
import type { TestRun } from "@testcenter-rewrite-app/domain";
import { mergeVeronaSharedParameters,
  normalizeVeronaSharedParameters, parseVeronaUnitResponse } from "@testcenter-rewrite-app/contracts";

export class ParticipantResponseTypeError extends Error {
  constructor() { super("Response part types require at most 50 valid Unicode characters without NUL."); this.name = "ParticipantResponseTypeError"; }
}
const requireResponsePartType = (value: string): string => {
  // Source unit_data.response_type is varchar(50). Validate once before copying
  // the incoming type to accepted parts; a large type must not amplify a packet.
  const characters = Array.from(value);
  if (characters.length > 50 || characters.some(character => {
    const point = character.codePointAt(0)!;
    return point === 0 || point >= 0xd800 && point <= 0xdfff;
  })) throw new ParticipantResponseTypeError();
  return value;
};

/** Called inside the Run transaction, before evaluating navigation/completion. */
export const withOrderedParticipantResponse = (input: {
  testRun: TestRun;
  unitKey: string;
  response: string;
  responseTimestamp?: number;
  timestamp: string;
}): TestRun => {
  const { testRun, unitKey } = input;
  const currentResponse = Object.hasOwn(testRun.unitResponses, unitKey)
    ? testRun.unitResponses[unitKey] : undefined;
  const previous = testRun.unitResponseFieldTimestamps && Object.hasOwn(testRun.unitResponseFieldTimestamps, unitKey)
    ? testRun.unitResponseFieldTimestamps[unitKey] : readParticipantResponseFieldTimestamps(currentResponse);
  const hasCapturedFields = readParticipantResponseFieldTimestamps(input.response) !== undefined;
  const reconciled = reconcileParticipantResponse({ currentResponse, currentTimestamps: previous,
    incomingResponse: input.response, capturedAt: input.responseTimestamp ??
      (hasCapturedFields ? Date.parse(input.timestamp) : nextParticipantResponseTimestamp(previous, Date.parse(input.timestamp))) });
  // The merged packet has only one global type. Capture the incoming type for
  // each accepted part before that global field can overwrite earlier history.
  // A new part can be older than other parts and still be accepted by Source.
  const incoming = parseVeronaUnitResponse(input.response);
  const byUnit = new Map(Object.entries(testRun.unitResponsePartTypes ?? {}));
  if (!incoming) {
    if (reconciled.acceptedFields > 0) byUnit.delete(unitKey);
  } else {
    const byPart = new Map(Object.entries(byUnit.get(unitKey) ?? {}));
    let acceptedType: string | undefined;
    const oldClocks = new Map(Object.entries(previous?.dataParts ?? {}));
    for (const [part, clock] of Object.entries(reconciled.timestamps.dataParts ?? {})) {
      if (clock > Math.max(oldClocks.get(part) ?? 0, previous?.opaque ?? 0)) {
        acceptedType ??= requireResponsePartType(typeof incoming.unitState.unitStateDataType === "string"
          ? incoming.unitState.unitStateDataType : "unknown");
        byPart.set(part, acceptedType);
      }
    }
    if (byPart.size) byUnit.set(unitKey, Object.fromEntries(byPart));
  }
  let result: TestRun = { ...testRun,
    unitResponses: { ...testRun.unitResponses, [unitKey]: reconciled.response },
    ...(testRun.unitResponsePartTypes !== undefined || byUnit.size
      ? { unitResponsePartTypes: Object.fromEntries(byUnit) } : {}),
    unitResponseFieldTimestamps: { ...testRun.unitResponseFieldTimestamps, [unitKey]: reconciled.timestamps } };
  const sharedClock = reconciled.timestamps.playerState?.sharedParameters ?? 0;
  if (sharedClock > Math.max(previous?.playerState?.sharedParameters ?? 0, previous?.opaque ?? 0)) {
    const shared = normalizeVeronaSharedParameters(parseVeronaUnitResponse(reconciled.response)?.playerState?.sharedParameters);
    const clocks = new Map(Object.entries(testRun.sharedParameterTimestamps ?? {}));
    const accepted = shared.filter(parameter => sharedClock > (clocks.get(parameter.key) ?? 0));
    if (accepted.length) {
      for (const parameter of accepted) clocks.set(parameter.key, sharedClock);
      result = { ...result, sharedParameters: mergeVeronaSharedParameters(testRun.sharedParameters, accepted),
        sharedParameterTimestamps: Object.fromEntries(clocks) };
    }
  }
  return result;
};
