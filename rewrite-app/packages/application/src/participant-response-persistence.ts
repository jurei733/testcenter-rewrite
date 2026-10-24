import { nextParticipantResponseTimestamp, readParticipantResponseFieldTimestamps } from "@testcenter-rewrite-app/contracts/participant-response-field-timestamps";
import { reconcileParticipantResponse } from "@testcenter-rewrite-app/contracts/participant-response-order";
import type { TestRun } from "@testcenter-rewrite-app/domain";
import { mergeVeronaSharedParameters,
  normalizeVeronaSharedParameters, parseVeronaUnitResponse } from "@testcenter-rewrite-app/contracts";

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
  let result: TestRun = { ...testRun,
    unitResponses: { ...testRun.unitResponses, [unitKey]: reconciled.response },
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
