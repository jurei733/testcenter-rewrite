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
