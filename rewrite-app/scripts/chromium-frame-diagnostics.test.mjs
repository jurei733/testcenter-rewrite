import assert from "node:assert/strict";
import { test } from "node:test";
import { captureChromiumFrameDiagnostics, redactBrowserDiagnostic } from "./chromium-frame-diagnostics.mjs";

test("browser diagnostics redact resource capabilities and query/header credentials", () => {
  const source = 'https://example.test/resources/.access/secret-capability/runtime.html?password=secret-password&sessionToken=secret-token&ui=original Bearer header-secret';
  const result = redactBrowserDiagnostic(source);
  assert.equal(result, 'https://example.test/resources/.access/[redacted]/runtime.html?password=[redacted]&sessionToken=[redacted]&ui=original Bearer [redacted]');
  assert.ok(!result.includes("secret"));
  assert.equal(redactBrowserDiagnostic('{"url":"/resources/.access/secret/runtime.html"}'),
    '{"url":"/resources/.access/[redacted]/runtime.html"}');
});

test("native diagnostics observe otherwise-unlisted child frames without reading input values", async () => {
  const frames = [{ id: "outer" }];
  const calls = [], lines = [];
  let listener, detached = false;
  const session = {
    on: (name, callback) => { assert.equal(name, "Runtime.executionContextCreated"); listener = callback; },
    send: async (name, args) => {
      calls.push([name, args]);
      if (name === "Page.getFrameTree") return { frameTree: { childFrames: [{ frame: {
        id: "nested", url: "http://example.test/resources/.access/private-capability/runtime.html"
      } }] } };
      if (name === "Runtime.enable") {
        listener({ context: { id: 7, auxData: { isDefault: true, frameId: "nested" } } });
        listener({ context: { id: 8, auxData: { isDefault: false, frameId: "nested" } } });
        return {};
      }
      assert.equal(name, "Runtime.evaluate");
      assert.equal(args.contextId, 7);
      assert.ok(!args.expression.includes(".value"), "Diagnostics must never inspect participant input values.");
      assert.ok(args.expression.includes("getBoundingClientRect"));
      return { result: { type: "string", value: '{"origin":"null","runtimeAdapter":true}' } };
    },
    detach: async () => { detached = true; }
  };
  await captureChromiumFrameDiagnostics({ newCDPSession: async frame => {
    assert.equal(frame, frames[0]); return session;
  } }, { frames: () => frames }, line => lines.push(line));
  assert.equal(lines.length, 2);
  assert.ok(lines[0].includes('"nested"'));
  assert.ok(!lines.join("\n").includes("private-capability"));
  assert.equal(calls.filter(([name]) => name === "Runtime.evaluate").length, 1);
  assert.equal(detached, true);
});

test("failed native capture is reported and sessions are detached", async () => {
  const lines = [];
  let detached = false;
  const session = {
    on: () => {}, send: async () => { throw new Error("Closed target /resources/.access/secret/runtime.html"); },
    detach: async () => { detached = true; }
  };
  await captureChromiumFrameDiagnostics({ newCDPSession: async () => session },
    { frames: () => [{}] }, line => lines.push(line));
  assert.equal(detached, true);
  assert.ok(lines[0].startsWith("ib_native_diagnostics_unavailable="));
  assert.ok(!lines[0].includes("secret"));
});

test("stalled native diagnostics cannot replace or indefinitely delay the test failure", async () => {
  const lines = [];
  let detached = false;
  const session = { on: () => {}, send: () => new Promise(() => {}), detach: async () => { detached = true; } };
  await captureChromiumFrameDiagnostics({ newCDPSession: async () => session },
    { frames: () => [{}] }, line => lines.push(line), 10);
  assert.equal(detached, true);
  assert.deepEqual(lines, ["ib_native_diagnostics_unavailable=Error: Native frame diagnostics timed out."]);
});

test("a session attached after the diagnostic deadline is detached without inspecting it", async () => {
  let attach, detached = false;
  const attaching = new Promise(resolve => { attach = resolve; });
  await captureChromiumFrameDiagnostics({ newCDPSession: () => attaching },
    { frames: () => [{}] }, () => {}, 10);
  attach({ detach: async () => { detached = true; },
    send: () => { throw new Error("Late sessions must not send diagnostic requests."); } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(detached, true);
});
