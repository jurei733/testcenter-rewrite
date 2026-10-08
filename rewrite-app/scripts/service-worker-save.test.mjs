import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

// Evaluate the shipped classic worker, then exercise its real drain function
// with deterministic storage/network boundaries. No duplicate retry algorithm.
const source = readFileSync(new URL("../apps/web/src/service-worker.js", import.meta.url), "utf8");
const context = {
  URL,
  self: {
    location: { origin: "https://testcenter.example" },
    registration: { scope: "https://testcenter.example/app/" },
    addEventListener() {}
  }
};
runInNewContext(`${source}\nglobalThis.testDrain = drainParticipantBackgroundSaves;`, context);
const drain = context.testDrain;
const record = (suffix = "a") => ({
  key: `run-${suffix}:unit-${suffix}`,
  entry: {
    version: 1, deliveryId: `delivery-${suffix}`, testRunId: `run-${suffix}`,
    unitKey: `unit-${suffix}`, response: '{"answer":"keep this exactly"}',
    status: "running", logs: [], queuedAt: "2026-10-03T12:00:00.000Z"
  }
});
const response = status => ({ status, ok: status >= 200 && status < 300 });
const fixture = (records = [record()]) => {
  const pending = new Map(records.map(item => [item.key, structuredClone(item)]));
  const sent = [];
  const run = send => drain({
    readRecords: async () => [...pending.values()],
    send: async (url, init) => { sent.push({ url: String(url), init }); return send(url, init); },
    removeRecord: async (key, deliveryId) => {
      if (pending.get(key)?.entry.deliveryId === deliveryId) pending.delete(key);
    },
    removeInvalidRecord: async key => pending.delete(key)
  });
  return { pending, sent, run };
};

test("background saves retain exact responses and IDs across authentication and transient failures", async () => {
  for (const status of [401, 403, 408, 429, 500, 503, 307]) {
    const { pending, sent, run } = fixture();
    const original = structuredClone([...pending.values()]);
    await assert.rejects(run(async () => response(status)), /remain queued/);
    assert.deepEqual([...pending.values()], original, `HTTP ${status} must not discard a pending answer.`);
    await run(async () => response(201));
    assert.equal(pending.size, 0);
    assert.equal(sent.length, 2);
    assert.equal(sent[0].init.body, sent[1].init.body);
    assert.equal(sent[0].url, "https://testcenter.example/api/v1/participant/test-runs/run-a/save-progress");
    assert.deepEqual(JSON.parse(sent[0].init.body), {
      deliveryId: "delivery-a", responseUnitKey: "unit-a", status: "running",
      unitResponse: original[0].entry.response, logs: []
    });
  }
});

test("background saves retain network failures and continue independently with other Units", async () => {
  const { pending, run } = fixture([record("a"), record("b")]);
  await assert.rejects(run(async url => {
    if (String(url).includes("run-a")) throw new Error("offline");
    return response(200);
  }), /remain queued/);
  assert.deepEqual([...pending.keys()], ["run-a:unit-a"]);
  await run(async () => response(204));
  assert.equal(pending.size, 0);
});

test("background saves retain an unauthorized Unit while delivering other valid Units", async () => {
  const { pending, run } = fixture([record("a"), record("b")]);
  await assert.rejects(run(async url => response(String(url).includes("run-a") ? 401 : 201)), /remain queued/);
  assert.deepEqual([...pending.keys()], ["run-a:unit-a"]);
  await run(async () => response(201));
  assert.equal(pending.size, 0);
});

test("background saves keep permanent rejection behavior and reject malformed records", async () => {
  for (const status of [400, 404, 409, 410, 413, 422]) {
    const { pending, run } = fixture();
    await run(async () => response(status));
    assert.equal(pending.size, 0);
  }
  const { pending, sent, run } = fixture([{ key: "invalid-record", entry: { version: 999 } }]);
  await run(async () => response(201));
  assert.equal(pending.size, 0);
  assert.equal(sent.length, 0);
});

test("background delivery renews only the bearer envelope, preserving the answer and delivery ID", async () => {
  const item = { ...record(), sessionToken: "a".repeat(43) };
  const { pending, sent, run } = fixture([item]);
  await assert.rejects(run(async () => response(401)), /remain queued/);
  pending.get(item.key).sessionToken = "b".repeat(43);
  await run(async () => response(200));
  assert.equal(sent[0].init.headers.authorization, `Bearer ${item.sessionToken}`);
  assert.equal(sent[1].init.headers.authorization, `Bearer ${"b".repeat(43)}`);
  assert.equal(sent[0].init.body, sent[1].init.body);
  assert.equal(sent[0].url, sent[1].url);
  assert.equal(sent[0].init.body.includes(item.sessionToken), false);
  assert.equal(pending.size, 0);
});

test("invalid background bearer metadata cannot discard an otherwise valid answer", async () => {
  for (const sessionToken of ["r1." + "a".repeat(43), "Bearer injected\r\nheader", {}, "x".repeat(257)]) {
    const item = { ...record(), sessionToken };
    const { pending, sent, run } = fixture([item]);
    await assert.rejects(run(async () => response(401)), /remain queued/);
    assert.equal(pending.size, 1);
    assert.equal(sent[0].init.headers.authorization, undefined);
    assert.deepEqual(JSON.parse(sent[0].init.body).unitResponse, item.entry.response);
  }
});
