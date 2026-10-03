import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { participantExecutionModes, participantExecutionModeDefinitions } from "@testcenter-rewrite-app/domain";

test("participant mode capabilities match the pinned Original Testcenter 19 definitions", () => {
  const reference = JSON.parse(readFileSync(
    "test-fixtures/original-testcenter/test-mode-19.0.json", "utf8"
  ));
  assert.equal(reference.sourceCommit, "c35cff81383949b4664e0fdffa3ba1154d144d9d");
  const originalParticipantModes = Object.keys(reference.definitions)
    .filter(mode => mode.startsWith("RUN-")).map(mode => mode.toLowerCase()).sort();
  assert.deepEqual([...participantExecutionModes].sort(), originalParticipantModes);
  for (const mode of participantExecutionModes) {
    const original = reference.definitions[mode.toUpperCase()];
    // Login-failure locking is an authentication concern, not a run capability.
    const { lockAfterFailedLogins: _loginPolicy, ...capabilities } = original.config;
    assert.deepEqual(participantExecutionModeDefinitions[mode], {
      mode, label: original.label, ...capabilities
    }, mode);
  }
});
