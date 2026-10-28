import assert from "node:assert/strict";
import { createInterface } from "node:readline";

export function createServerRequestFailureGate() {
  const failures = new Map();
  const observeLine = line => {
    let event;
    try { event = JSON.parse(line); } catch { return; }
    if (event?.event !== "http_request_failed" &&
      !(event?.event === "http_request_completed" && event.statusCode >= 500)) return;
    const failure = { requestId: event.requestId, method: event.method,
      route: event.route, path: event.path, statusCode: event.statusCode,
      error: event.error };
    // The failure event and the completed 500 belong to the same request.
    const key = event.requestId ?? Symbol();
    failures.set(key, { ...failures.get(key), ...Object.fromEntries(
      Object.entries(failure).filter(([, value]) => value !== undefined)) });
  };
  const observeStream = input => createInterface({ input }).on("line", observeLine);
  const assertHealthy = (expectedFailures = []) => {
    assert.ok(Array.isArray(expectedFailures), "Expected server failures require explicit request receipts.");
    const keys = ["requestId", "method", "route", "path", "statusCode"].sort();
    const ids = new Set();
    for (const receipt of expectedFailures) {
      assert.deepEqual(Object.keys(receipt).sort(), keys, "Expected failures require every exact request field.");
      for (const key of ["requestId", "method", "route", "path"]) assert.ok(typeof receipt[key] === "string" && receipt[key], "Expected failure request fields must be nonempty strings.");
      assert.ok(Number.isInteger(receipt.statusCode) && receipt.statusCode >= 500 && receipt.statusCode <= 599);
      assert.ok(!ids.has(receipt.requestId), "An expected request receipt cannot be repeated.");
      ids.add(receipt.requestId);
      // Do not discard or consume observations. A separate backend error
      // event adds error details and must fail this exact comparison too.
      assert.deepEqual(failures.get(receipt.requestId), receipt, "The exact expected Source failure was not observed.");
    }
    assert.equal(failures.size, expectedFailures.length,
      `The own API emitted failed requests during the UI smoke: ${JSON.stringify([...failures.values()])}`);
  };
  return { observeLine, observeStream, assertHealthy };
}
