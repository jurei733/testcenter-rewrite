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
  const assertHealthy = () => assert.equal(failures.size, 0,
    `The own API emitted failed requests during the UI smoke: ${JSON.stringify([...failures.values()])}`);
  return { observeLine, observeStream, assertHealthy };
}
