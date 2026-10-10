import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const modes = ["pending-pause", "pending-terminate", "queued-pause", "queued-terminate"];
assert.equal(process.argv.length, 6, "Pass the four completed Source exit.json files in pending-pause, pending-terminate, queued-pause, queued-terminate order.");
const cases = {};
for (const [index, mode] of modes.entries()) {
  const source = JSON.parse(await readFile(process.argv[index + 2], "utf8"));
  assert.equal(source.callerVerifiedReferenceCommit, "ee2ab9ab64bd91209ef8534bbe6005838024e46d");
  assert.deepEqual(source.errors, []);
  assert.deepEqual(source.unknown, []);
  assert.deepEqual(Object.keys(source.states), [mode]);
  const state = source.states[mode];
  const pending = mode.startsWith("pending-");
  const controllerStates = state.requests.flatMap(request => Array.isArray(request.body) ? request.body : [])
    .filter(entry => entry.key === "CONTROLLER").map(entry => entry.content);
  const acknowledgedCommandIds = state.acknowledgements.map(request => Number(request.pathname.match(/\/command\/(\d+)\/executed$/)[1]));
  assert.equal(state.first.iframeCount, 1);
  assert.equal(state.first.cardCount, 0);
  assert.ok(state.first.dialog);
  assert.equal(state.after.iframeCount, Number(pending));
  assert.equal(state.after.cardCount, Number(!pending));
  assert.ok(state.after.dialog);
  assert.deepEqual(controllerStates, ["LOADING", "RUNNING", "ERROR", ...(!pending ? [mode.endsWith("pause") ? "PAUSED" : "TERMINATED"] : [])]);
  assert.deepEqual(acknowledgedCommandIds, pending ? [] : [1, 2]);
  assert.equal(state.commandPollCount, mode === "queued-pause" ? 2 : 1);
  const returnedToStarter = new URL(state.after.url).hash === "#/r/starter";
  assert.equal(returnedToStarter, mode === "queued-terminate");
  if (pending) assert.equal(state.after.url, state.first.url);
  cases[mode] = {
    iframePreserved: state.after.iframeCount === 1,
    cardCount: state.after.cardCount,
    dialogRetained: Boolean(state.after.dialog),
    commandPollCount: state.commandPollCount,
    controllerStates,
    acknowledgedCommandIds,
    returnedToStarter
  };
}
await writeFile(new URL("./fixtures/original-runtime-command-overlap.json", import.meta.url), JSON.stringify({
  referenceRevision: "ee2ab9ab64bd91209ef8534bbe6005838024e46d",
  scope: "Source frontend on owned API/player fixtures; no Source backend control-state equivalence proof",
  cases
}, null, 2) + "\n");
console.log("Verified Source runtime command overlap fixture: 4 cases.");
