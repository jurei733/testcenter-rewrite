import assert from "node:assert/strict";
import test from "node:test";
import { reloadParticipantUnitLabelPlayer } from "./participant-unit-label-smoke.mjs";

test("actual label smoke reload waits for document and then actual Player, not idle live connections", async () => {
  const events = [];
  let documentReady;
  let playerReady;
  let playerStarted;
  const document = new Promise(resolve => { documentReady = resolve; });
  const player = new Promise(resolve => { playerReady = resolve; });
  const started = new Promise(resolve => { playerStarted = resolve; });
  let complete = false;
  const operation = reloadParticipantUnitLabelPlayer({ reload(options) {
    assert.deepEqual(options, { waitUntil: "domcontentloaded" });
    events.push("reload");
    return document;
  } }, () => {
    events.push("player");
    playerStarted();
    return player;
  }).then(() => { complete = true; });
  assert.deepEqual(events, ["reload"]);
  assert.equal(complete, false);
  documentReady();
  await started;
  assert.deepEqual(events, ["reload", "player"]);
  assert.equal(complete, false, "Document readiness alone cannot pass the Player gate.");
  playerReady();
  await operation;
  assert.equal(complete, true);
});

test("actual label reload propagates navigation failure without querying a stale Player", async () => {
  const failure = new Error("actual document navigation failed");
  let readinessCalls = 0;
  await assert.rejects(reloadParticipantUnitLabelPlayer({ async reload() { throw failure; } }, () => {
    readinessCalls++;
  }), error => error === failure);
  assert.equal(readinessCalls, 0);
});

test("actual label reload propagates missing Player after successful navigation", async () => {
  const failure = new Error("actual Player unavailable");
  await assert.rejects(reloadParticipantUnitLabelPlayer({ async reload() {} }, async () => { throw failure; }),
    error => error === failure);
});

test("actual label reload awaits asynchronous document rejection", async () => {
  const failure = new Error("document reload rejected late");
  let rejectDocument;
  let readinessCalls = 0;
  const operation = reloadParticipantUnitLabelPlayer({ reload() {
    return new Promise((resolve, reject) => { rejectDocument = reject; });
  } }, () => { readinessCalls++; });
  rejectDocument(failure);
  await assert.rejects(operation, error => error === failure);
  assert.equal(readinessCalls, 0);
});
