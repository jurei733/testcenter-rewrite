import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { raceWithSmokeDeadline } from "./smoke-deadline.mjs";

test("an already completed smoke exits without waiting for its old 60-second timer", () => {
  const source = `import {raceWithSmokeDeadline} from ${JSON.stringify(new URL("./smoke-deadline.mjs",import.meta.url).href)};
    await raceWithSmokeDeadline(Promise.resolve(),60000,()=>{throw Error('must not fire');});
    console.log('completed');`;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", source], {encoding:"utf8",timeout:2000});
  assert.equal(result.error, undefined); assert.equal(result.status,0); assert.equal(result.stdout,"completed\n");
  // Prove that the old Promise.race pattern is caught by the same process test.
  const legacy = spawnSync(process.execPath,["--input-type=module","-e",
    "await Promise.race([Promise.resolve(),new Promise(resolve=>setTimeout(resolve,60000))]);"],
    {timeout:250});
  assert.equal(legacy.error?.code,"ETIMEDOUT");
});

test("successful and rejected work preserve their exact result and cancel later cleanup", async () => {
  let calls=0;
  const value={closed:true}, failure=Error("original failure");
  assert.equal(await raceWithSmokeDeadline(Promise.resolve(value),10,()=>calls++),value);
  await assert.rejects(raceWithSmokeDeadline(Promise.reject(failure),10,()=>calls++),error=>error===failure);
  await delay(30); assert.equal(calls,0);
});

test("an actually stalled smoke still executes timeout cleanup once and fails with its original error", async () => {
  let calls=0; const failure=Error("Owned API shutdown timed out");
  await assert.rejects(raceWithSmokeDeadline(new Promise(()=>{}),10,()=>{calls++;throw failure;}),error=>error===failure);
  await delay(20); assert.equal(calls,1);
});

test("a soft shutdown deadline preserves escalation without hiding rejection", async () => {
  let calls=0;
  assert.equal(await raceWithSmokeDeadline(new Promise(()=>{}),10,()=>{calls++;return "escalate";}),"escalate");
  assert.equal(calls,1);
});
