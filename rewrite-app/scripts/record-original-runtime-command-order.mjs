import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const modes = ["queued-pause-resume", "queued-pause-resume-reversed-acks"];
assert.equal(process.argv.length, 4, `Pass the two completed Source exit.json files in this order: ${modes.join(", ")}.`);
const cases = {};
for (const [index, mode] of modes.entries()) {
  const source = JSON.parse(await readFile(process.argv[index + 2], "utf8"));
  assert.equal(source.callerVerifiedReferenceCommit, "ee2ab9ab64bd91209ef8534bbe6005838024e46d");
  assert.deepEqual(source.errors, []);
  assert.deepEqual(source.unknown, []);
  assert.deepEqual(Object.keys(source.states), [mode]);
  const state = source.states[mode];
  const reversed = index === 1;
  const controllerStates = state.requests.flatMap(request => Array.isArray(request.body) ? request.body : [])
    .filter(entry => entry.key === "CONTROLLER").map(entry => entry.content);
  const commandEffects = state.requests.flatMap(request => Array.isArray(request.body) ? request.body : [])
    .filter(entry => entry.key === "command executed").map(entry => entry.content);
  const acknowledgedCommandIds = state.acknowledgements.map(request => Number(request.pathname.match(/\/command\/(\d+)\/executed$/)[1]));
  assert.deepEqual(acknowledgedCommandIds, [1, 2]);
  assert.deepEqual(state.acknowledgementCompletionOrder, reversed ? [2, 1] : [1, 2]);
  assert.deepEqual(controllerStates, ["LOADING", "RUNNING", "ERROR", ...(reversed ? ["RUNNING", "PAUSED"] : ["PAUSED", "RUNNING"])]);
  assert.deepEqual(commandEffects, reversed ? ["resume", "pause"] : ["pause", "resume"]);
  assert.equal(state.first.iframeCount, 1);
  assert.equal(state.first.cardCount, 0);
  assert.equal(state.first.samePlayerFrameAsBeforeError, true);
  assert.ok(state.first.dialog);
  assert.equal(state.after.iframeCount, Number(!reversed));
  assert.equal(state.after.cardCount, Number(reversed));
  assert.equal(state.after.samePlayerFrameAsBeforeError, false);
  assert.ok(state.after.dialog);
  assert.equal(state.commandPollCount, 2);
  assert.match(new URL(state.after.url).hash, /[?&]reload=\d+/);
  cases[mode] = { acknowledgedCommandIds, acknowledgementCompletionOrder: state.acknowledgementCompletionOrder,
    controllerStates, commandEffects, iframeCount: state.after.iframeCount, cardCount: state.after.cardCount,
    dialogRetained: true, oldPlayerFrameRetired: true, commandPollCount: state.commandPollCount };
}
await writeFile(new URL("./fixtures/original-runtime-command-order.json", import.meta.url), JSON.stringify({
  referenceRevision: "ee2ab9ab64bd91209ef8534bbe6005838024e46d",
  scope: "Source frontend on owned API/player fixtures; effects follow successful ACK completion, not guaranteed issuance FIFO",
  cases
}, null, 2) + "\n");
console.log("Verified Source runtime ACK-order fixture: 2 cases.");
