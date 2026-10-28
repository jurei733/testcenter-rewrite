import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { once } from "node:events";
import test from "node:test";
import { createServerRequestFailureGate } from "./server-request-failure-gate.mjs";

test("The UI server gate accepts successful requests, expected 4xx and unrelated diagnostics", () => {
  const gate = createServerRequestFailureGate();
  for (const statusCode of [200, 205, 302, 400, 401, 403, 404, 409, 422, 429]) {
    gate.observeLine(JSON.stringify({ event: "http_request_completed", statusCode }));
  }
  gate.observeLine("not JSON");
  gate.observeLine("null");
  gate.observeLine(JSON.stringify({ event: "diagnostic", statusCode: 500 }));
  assert.doesNotThrow(gate.assertHealthy);
});

test("The UI server gate keeps the original failure and deduplicates its completed 500", () => {
  const gate = createServerRequestFailureGate();
  gate.observeLine(JSON.stringify({ event: "http_request_failed", requestId: "own-request",
    method: "POST", path: "/own/test-logs", error: { message: "database or disk is full" } }));
  gate.observeLine(JSON.stringify({ event: "http_request_completed", requestId: "own-request",
    method: "POST", path: "/own/test-logs", statusCode: 500 }));
  assert.throws(gate.assertHealthy, error => error.message.includes('"statusCode":500') &&
    error.message.includes("database or disk is full") &&
    (error.message.match(/own-request/g) ?? []).length === 1);
});

for (const statusCode of [500, 502, 503]) {
  test(`The UI server gate rejects a real HTTP ${statusCode} without a separate error event`, () => {
    const gate = createServerRequestFailureGate();
    gate.observeLine(JSON.stringify({ event: "http_request_completed", statusCode }));
    assert.throws(gate.assertHealthy, /The own API emitted failed requests/);
  });
}

test("The UI server gate consumes split UTF-8 chunks and the last line without a newline", async () => {
  const gate = createServerRequestFailureGate(), stream = new PassThrough();
  const lines = gate.observeStream(stream), finished = once(lines, "close");
  const content = Buffer.from(JSON.stringify({ event: "http_request_failed", requestId: "own-ä",
    error: { message: "own failure" } }));
  const split = content.indexOf(Buffer.from("ä")) + 1;
  stream.write(content.subarray(0, split));
  stream.end(content.subarray(split));
  await finished;
  assert.throws(gate.assertHealthy, /own-ä/);
});

const expectedSourceFailure = { requestId: 'owned-source-request', method: 'PATCH', route: 'PATCH /test/:testId/lock', path: '/test/:testId/lock', statusCode: 500 };
const observedSourceFailure = { event: 'http_request_completed', ...expectedSourceFailure };
test('The UI server gate requires an independently supplied exact receipt for a Source-proven negative case', () => {
  const gate = createServerRequestFailureGate();
  gate.observeLine(JSON.stringify(observedSourceFailure));
  assert.throws(gate.assertHealthy, /The own API emitted failed requests/);
  assert.doesNotThrow(() => gate.assertHealthy([expectedSourceFailure]));
  assert.throws(gate.assertHealthy, /The own API emitted failed requests/, 'Checking a receipt must not discard the original failure.');
});
for (const key of ['requestId', 'method', 'route', 'path', 'statusCode']) {
  test('The UI server gate rejects an expected receipt with the wrong '+key, () => {
    const gate = createServerRequestFailureGate();gate.observeLine(JSON.stringify(observedSourceFailure));
    assert.throws(() => gate.assertHealthy([{...expectedSourceFailure,[key]:key==='statusCode'?503:'different-request-field'}]));
  });
}
test('The UI server gate rejects missing, duplicate or incomplete receipts and additional failures', () => {
  const gate = createServerRequestFailureGate();
  assert.throws(() => gate.assertHealthy([expectedSourceFailure]), /not observed/);
  gate.observeLine(JSON.stringify(observedSourceFailure));
  assert.throws(() => gate.assertHealthy([expectedSourceFailure,expectedSourceFailure]), /cannot be repeated/);
  assert.throws(() => gate.assertHealthy([{requestId:expectedSourceFailure.requestId,statusCode:500}]), /every exact request field/);
  gate.observeLine(JSON.stringify({...observedSourceFailure,requestId:'another-failed-request'}));
  assert.throws(() => gate.assertHealthy([expectedSourceFailure]), /The own API emitted failed requests/);
});
test('The UI server gate never accepts a backend exception as the expected negative HTTP response', () => {
  for (const order of ['before','after']) {
    const gate = createServerRequestFailureGate(),failed={event:'http_request_failed',requestId:expectedSourceFailure.requestId,error:{message:'real database or disk failure'}};
    for (const item of order==='before'?[failed,observedSourceFailure]:[observedSourceFailure,failed])gate.observeLine(JSON.stringify(item));
    assert.throws(() => gate.assertHealthy([expectedSourceFailure]), /not observed/);
  }
});
