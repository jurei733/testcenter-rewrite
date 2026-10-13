import assert from "node:assert/strict";
import test from "node:test";
import type { TestRun } from "@testcenter-rewrite-app/domain";
import { participantControllerDispatchSuperseded, withParticipantControllerDispatch } from "./participant-controller-dispatch.js";

const run: TestRun = { testRunId: "owned", participantSessionId: "session", tenantId: "tenant", workspaceId: "workspace",
  contentReleaseId: "release", bookletKey: "booklet", status: "running", currentUnitKey: "unit", unitResponses: { unit: "Exact answer Ω" },
  createdAt: "2026-10-13T00:00:00.000Z", updatedAt: "2026-10-13T00:00:00.000Z", completedAt: null };
test("dispatch marks belong to one controller and ignore forged projection metadata", () => {
  const first = withParticipantControllerDispatch(run, { ...run, controllerDispatches: { forged: 999 } }, { controllerId: "owned", sequence: 2 });
  assert.deepEqual(first.controllerDispatches, { owned: 2 });
  assert.equal(participantControllerDispatchSuperseded(first, { controllerId: "owned", sequence: 1 }), true);
  assert.equal(participantControllerDispatchSuperseded(first, { controllerId: "other", sequence: 1 }), false);
  assert.deepEqual(withParticipantControllerDispatch(first, { ...run, controllerDispatches: { forged: 999 } }).controllerDispatches, { owned: 2 });
  const special = withParticipantControllerDispatch(first, first, { controllerId: "__proto__", sequence: 1 });
  assert.equal(Object.hasOwn(special.controllerDispatches!, "__proto__"), true);
  assert.equal(Object.getPrototypeOf(special.controllerDispatches!), Object.prototype);
  assert.equal(participantControllerDispatchSuperseded(special, { controllerId: "__proto__", sequence: 1 }), true);
  assert.deepEqual(run.unitResponses, first.unitResponses);
});
test("malformed stored dispatch marks reject the whole projection", () => {
  for (const controllerDispatches of [null, [], { owned: 0 }, { owned: Number.MAX_SAFE_INTEGER + 1 }]) {
    assert.throws(() => withParticipantControllerDispatch({ ...run, controllerDispatches: controllerDispatches as Record<string, number> }, run), /dispatches are invalid/);
  }
});
