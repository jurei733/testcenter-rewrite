import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { runtimeErrorContractCases } from "./runtime-error-contract-fixture.mjs";

assert.ok(process.argv[2], "Pass the completed Source probe's exit.json.");
const source = JSON.parse(await readFile(process.argv[2], "utf8"));
assert.equal(source.callerVerifiedReferenceCommit, "ee2ab9ab64bd91209ef8534bbe6005838024e46d");
assert.deepEqual(source.errors, []);
assert.deepEqual(source.unknown, []);
assert.deepEqual(Object.keys(source.states), runtimeErrorContractCases.map(s => s.key));
const cases = Object.fromEntries(runtimeErrorContractCases.map(scenario => {
  const s = source.states[scenario.key];
  assert.equal(JSON.stringify(s.definition), JSON.stringify(scenario));
  const controllerErrorWriteCount = s.errorRequests.filter(q =>
    Array.isArray(q.body) && q.body.some(e => e.key === "CONTROLLER" && e.content === "ERROR")).length;
  assert.equal(controllerErrorWriteCount, 1);
  assert.equal(s.repeatedRuntimeLogCount, 2);
  assert.equal(s.repeatedDialogCount, 1);
  assert.equal(s.reloaded.dialog, null);
  const logs = s.errorRequests.flatMap(q => q.body?.logEntries ?? [])
    .filter(e => e.key === `Runtime Error: ${scenario.code}`);
  assert.deepEqual(logs.map(e => e.content), [scenario.message, "Second owned runtime Ω"]);
  const { content, ...collapsedDialog } = s.collapsed.dialog;
  return [scenario.key, {
    definition:s.definition, iframePreserved:s.collapsed.iframeCount === 1,
    cardCount:s.collapsed.cardCount, activeRole:s.collapsed.activeRole, collapsedDialog,
    introText:s.intro.text, introWhiteSpace:s.intro.whiteSpace,
    errorDescription:scenario.message, description:s.description,
    repeatedDialogCount:s.repeatedDialogCount, repeatedRuntimeLogCount:s.repeatedRuntimeLogCount,
    controllerErrorWriteCount
  }];
}));
await writeFile(new URL("./fixtures/original-runtime-error-contract.json", import.meta.url), JSON.stringify({
  referenceRevision:source.callerVerifiedReferenceCommit, scope:source.scope,
  note:"Missing-code is defensive Source behavior; the protocol requires a string code. Pointer is neutral before collapsed-dialog measurements.",
  cases
}, null, 2) + "\n");
console.log(`Verified Source runtime fixture: ${Object.keys(cases).length} cases.`);
