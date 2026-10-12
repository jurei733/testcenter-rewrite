import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, {
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}
}).outputText).toString("base64")}`;
const identities = await import(moduleUrl(readFileSync(new URL("../apps/web/src/app/participant-test-log-identities.ts", import.meta.url), "utf8")));
const source = readFileSync(new URL("../apps/web/src/app/participant-save-outbox.ts", import.meta.url), "utf8");
const workerUrl = moduleUrl("export function queueParticipantSaveForBackgroundDelivery(){};export function removeParticipantSaveFromBackgroundDelivery(){};export function discardParticipantBackgroundSavesForRun(){};");
const outbox = await import(moduleUrl(source.replace('from "./participant-save-background-sync"',`from ${JSON.stringify(workerUrl)}`)));
const log = {key:"CONTROLLER",content:"ERROR Ω",timeStamp:1_791_411_000_000};
const batch = entries => ({unitKey:null,originalUnitId:null,entries});
const packet = logs => ({version:1,deliveryId:"old-delivery",testRunId:"own-run",unitKey:"own-unit",response:"unchanged answer",status:"running",queuedAt:"2026-10-10T00:00:00Z",logs});
test("log-only outbox packets retain their marker through persistence and reload without changing legacy answer versions", () => {
  const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const entry=outbox.createParticipantSaveOutboxEntry({testRunId:"own-run",unitKey:"own-unit",response:"",status:"running",logOnly:true,logs:[batch([{...log,clientEntryId:"owned-log"}])]});
  assert.equal(entry.version,2);assert.equal(entry.logOnly,true);assert.equal(outbox.persistParticipantSaveOutboxEntry(entry,storage),true);
  assert.deepEqual(outbox.findParticipantSaveOutboxEntryForUnit("own-run","own-unit",storage),entry);
  const legacy=outbox.createParticipantSaveOutboxEntry({testRunId:"own-run",unitKey:"other-unit",response:"Exact answer",status:"running",logs:[]});
  assert.equal(legacy.version,1);assert.equal(Object.hasOwn(legacy,"logOnly"),false);
});

test("two distinct events with identical timestamps and content receive different stable identities", () => {
  const events=[{...log},{...log}],before=structuredClone(events);
  const identified=identities.identifyParticipantTestLogEntries(events);
  assert.notEqual(identified[0].clientEntryId,identified[1].clientEntryId);
  assert.ok(identified.every(e=>/^[A-Za-z0-9][A-Za-z0-9._:-]{0,209}$/.test(e.clientEntryId)));
  assert.deepEqual(identities.identifyParticipantTestLogEntries(identified),identified);
  assert.deepEqual(events,before);
});
test("legacy batch positions retain the exact server identity through reorder and replacement", () => {
  const old=packet([batch([{...log,clientEntryId:"already-stable"},{...log}]),{unitKey:"own-unit",originalUnitId:"original",entries:[{...log}]}]);
  const before=structuredClone(old),carried=identities.carriedParticipantTestLogBatches(old);
  assert.deepEqual(carried.flatMap(b=>b.entries.map(e=>e.clientEntryId)),["already-stable","old-delivery:log:1","old-delivery:log:2"]);
  const reordered=packet([...carried].reverse());reordered.deliveryId="replacement-delivery";
  assert.deepEqual(identities.carriedParticipantTestLogBatches(reordered),reordered.logs);
  assert.deepEqual(old,before);
});
test("the longest legacy delivery ID can be upgraded without exceeding the new entry bound", () => {
  const old=packet([batch(Array.from({length:200},()=>({...log})))]);old.deliveryId="a".repeat(200);
  const carried=identities.carriedParticipantTestLogBatches(old);
  assert.equal(carried[0].entries[199].clientEntryId,"a".repeat(200)+":log:199");
  assert.equal(carried[0].entries[199].clientEntryId.length,208);
});
test("durable serialization preserves stable log IDs and refuses malformed IDs without erasing another saved packet", () => {
  const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const saved=packet([batch([{...log,clientEntryId:"stable-entry"}])]);
  assert.equal(outbox.persistParticipantSaveOutboxEntry(saved,storage),true);
  assert.deepEqual(outbox.findParticipantSaveOutboxEntryForUnit("own-run","own-unit",storage),saved);
  for(const id of [null,13,"","has space","x".repeat(211)]) {
    const invalid=packet([batch([{...log,clientEntryId:id}])]);invalid.deliveryId="replacement";
    assert.equal(outbox.persistParticipantSaveOutboxEntry(invalid,storage),false);
    assert.deepEqual(outbox.findParticipantSaveOutboxEntryForUnit("own-run","own-unit",storage),saved);
  }
});
test("an absent carried packet contains no fabricated logs", () => {
  assert.deepEqual(identities.carriedParticipantTestLogBatches(null),[]);
});
