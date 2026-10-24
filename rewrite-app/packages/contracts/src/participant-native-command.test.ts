import assert from "node:assert/strict";
import test from "node:test";
import { isParticipantControllerTimerInterruptionRequest } from "./participant-native-command.js";

const legacy = { testRunId: "run", contentReleaseId: "release", bookletKey: "booklet", deliveryId: "legacy",
  keyword: "goto", arguments: ["id", "Unit Ω", "give 0"], controllerStatus: "RUNNING", timeStamp: 1791849600000 };
const request = { testRunId: "run", contentReleaseId: "release", bookletKey: "booklet", deliveryId: "modern",
  keyword: "pause", controllerStatus: "RUNNING", controllerDispatch: { controllerId: "owner", sequence: 1 },
  unitKey: "Unit Ω", testletKey: "timed", startedAt: "2026-10-13T00:00:00.000Z", expiresAt: "2026-10-13T00:01:00.000Z", remainingSeconds: 30 };

test("timer preparations preserve the old wire shape and accept a scoped unclocked retiming dependency", () => {
  assert.equal(isParticipantControllerTimerInterruptionRequest(request), true);
  for (const keyword of ["goto", "resume"]) assert.equal(isParticipantControllerTimerInterruptionRequest({ ...request,
    legacyCommand: { ...legacy, keyword }, observedAt: legacy.timeStamp + 1 }), true);
});
test("timer dependencies cannot name another immutable scope or a modern/terminal command", () => {
  const invalid = [null, [], {}, { ...legacy, testRunId: "other" }, { ...legacy, contentReleaseId: "other" },
    { ...legacy, bookletKey: "other" }, { ...legacy, deliveryId: request.deliveryId }, { ...legacy, deliveryId: "invalid/id" },
    { ...legacy, controllerDispatch: { controllerId: "owner", sequence: 1 } }, { ...legacy, terminationNoop: true },
    { ...legacy, keyword: "pause" }, { ...legacy, keyword: "terminate" }, { ...legacy, controllerStatus: "TERMINATED" },
    { ...legacy, arguments: [1] }, { ...legacy, timeStamp: 1.5 }];
  for (const legacyCommand of invalid) assert.equal(isParticipantControllerTimerInterruptionRequest({ ...request, legacyCommand, observedAt: legacy.timeStamp + 1 }), false);
});
test("a dependency and its observation time must be valid together", () => {
  for (const observedAt of [undefined, null, "1", -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER])
    assert.equal(isParticipantControllerTimerInterruptionRequest({ ...request, legacyCommand: legacy, observedAt }), false);
  assert.equal(isParticipantControllerTimerInterruptionRequest({ ...request, observedAt: legacy.timeStamp }), false);
});
