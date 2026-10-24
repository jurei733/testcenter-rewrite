import assert from "node:assert/strict";
import { createServer } from "node:net";
import test from "node:test";
import { createServer as createHttpServer } from "node:http";
import { request } from "playwright";
import { fetchHeldSmokeRoute } from "./fetch-held-smoke-route.mjs";
import { createSmokeRouteFailureGate, describeSmokeRouteFailure } from "./smoke-route-failure-gate.mjs";

test("held forwarding uses separate real HTTP connections and never replays a lost mutation reply", async () => {
  const received = [], sockets = new Set();
  const server = createHttpServer(async (req, res) => {
    let body = ""; for await (const part of req) body += part;
    received.push({ socket: req.socket, body, headers: req.headers, path: req.url });
    if (req.url === "/lost") { req.socket.destroy(); return; }
    res.writeHead(req.url === "/error" ? 500 : 200, { "content-type": "application/json" });
    res.end(JSON.stringify({ committed: body }));
  });
  server.on("connection", socket => { sockets.add(socket); socket.once("close", () => sockets.delete(socket)); });
  await new Promise(done => server.listen(0, "127.0.0.1", done));
  const client = await request.newContext();
  const headers = { authorization: "Bearer owned-http-test", "content-type": "application/json" };
  const forward = (path, body) => fetchHeldSmokeRoute({
    request: () => ({ headers: () => headers }),
    fetch: options => client.fetch(`http://127.0.0.1:${server.address().port}${path}`, { method: "POST", data: Buffer.from(body), ...options })
  });
  try {
    for (const body of ["first committed mutation", "second committed mutation"]) {
      const response = await forward("/ok", body);
      assert.equal(response.status(), 200); assert.deepEqual(await response.json(), { committed: body });
    }
    assert.notEqual(received[0].socket, received[1].socket);
    assert.ok(received.every(item => item.headers.connection === "close"));
    assert.ok(received.every(item => item.headers.authorization === headers.authorization));
    const gate = createSmokeRouteFailureGate(); let aborted = 0;
    await gate.wrap("owned lost mutation", async () => forward("/lost", "committed without reply"))({ abort: async () => { aborted++; } });
    await gate.settle(); assert.equal(aborted, 1);
    assert.throws(() => gate.assertHealthy(), /Owned browser route operation failed/);
    assert.equal(received.filter(item => item.path === "/lost").length, 1, "A committed POST cannot be replayed by the forwarding transport");
    assert.equal((await forward("/error", "failed mutation")).status(), 500);
    assert.equal(received.filter(item => item.path === "/error").length, 1);
    assert.deepEqual(headers, { authorization: "Bearer owned-http-test", "content-type": "application/json" });
  } finally {
    await client.dispose();
    for (const socket of sockets) socket.destroy();
    await new Promise(done => server.close(done));
  }
});

test("failure artifacts retain nested phases/codes without copying a wire header call log", () => {
  const cause = Object.assign(Error("route.fetch: read ECONNRESET\nCall log:\nAuthorization: owned-secret"), { code: "ECONNRESET" });
  const error = new AggregateError([Object.assign(Error("Owned route failed", { cause }), { startedIn: "scenario", failedIn: "cleanup" })], "Owned failure");
  const snapshot = describeSmokeRouteFailure(error);
  assert.equal(snapshot.errors[0].cause.message, "route.fetch: read ECONNRESET");
  assert.equal(snapshot.errors[0].cause.code, "ECONNRESET");
  assert.equal(snapshot.errors[0].startedIn, "scenario");
  assert.equal(snapshot.errors[0].failedIn, "cleanup");
  assert.ok(!JSON.stringify(snapshot).includes("owned-secret"));
  assert.ok(cause.message.includes("owned-secret"), "Keep the original native cause unchanged");
});

test("successful route operations preserve arguments, results and a primary scenario failure", async () => {
  const gate = createSmokeRouteFailureGate(), route = {};
  const handler = gate.wrap("owned", async received => { assert.equal(received, route); return 123; });
  assert.equal(await handler(route), 123);
  gate.assertHealthy();
  const primary = Error("Exact timer assertion");
  assert.equal(gate.failure(primary), primary);
});

test("an asynchronous route rejection becomes a failing gate with its unchanged protocol cause", async () => {
  const gate = createSmokeRouteFailureGate(), cause = Object.assign(Error("read ECONNRESET"), { code: "ECONNRESET" });
  await gate.wrap("**/controller-timer-interruptions", async () => { throw cause; })();
  assert.throws(() => gate.assertHealthy(), error => {
    assert.ok(error instanceof AggregateError);
    assert.equal(error.errors[0].cause, cause);
    assert.equal(error.errors[0].cause.code, "ECONNRESET");
    return true;
  });
});

test("a failed browser route completes its abort before its callback settles", async () => {
  const gate = createSmokeRouteFailureGate(), cause = Error("Owned route fetch failed");
  let releaseAbort, completed = false, abortCount = 0;
  const abort = new Promise(done => { releaseAbort = done; });
  const operation = gate.wrap("owned", async () => { throw cause; })({ abort: async code => {
    assert.equal(code, "failed"); abortCount++; await abort;
  } }).then(() => { completed = true; });
  let settled = false;
  const settling = gate.settle().then(() => { settled = true; });
  await new Promise(done => setImmediate(done));
  assert.equal(abortCount, 1);
  assert.equal(completed, false, "Teardown must not advance while this route is unhandled");
  assert.equal(settled, false);
  releaseAbort(); await operation; await settling;
  assert.throws(() => gate.assertHealthy(), error => error.errors[0].cause === cause);
});

test("an abort failure remains secondary to the original scenario and protocol errors", async () => {
  const gate = createSmokeRouteFailureGate(), protocol = Error("Protocol reset"), abort = Error("Closed target");
  await gate.wrap("owned", async () => { throw protocol; })({ abort: async () => { throw abort; } });
  const primary = Error("Original timer assertion"), combined = gate.failure(primary);
  assert.equal(combined.errors[0], primary);
  assert.equal(combined.errors[1].cause, protocol);
  assert.equal(combined.errors[2].cause, abort);
});

test("a real late HTTP body failure cannot replace an earlier scenario assertion during cleanup", async () => {
  const sockets = new Set(); let endResponse, gotHeaders;
  const headers = new Promise(done => { gotHeaders = done; });
  const server = createServer(socket => {
    sockets.add(socket); socket.once("close", () => sockets.delete(socket));
    socket.once("data", () => {
      socket.write("HTTP/1.1 200 OK\r\nContent-Length: 20\r\nConnection: close\r\n\r\n{");
      endResponse = () => socket.end();
    });
  });
  await new Promise(done => server.listen(0, "127.0.0.1", done));
  const gate = createSmokeRouteFailureGate(); let nativeFailure;
  try {
    const operation = gate.wrap("owned body", async () => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/owned`);
      gotHeaders();
      try { await response.text(); } catch (error) { nativeFailure = error; throw error; }
    })();
    await headers;
    const primary = new assert.AssertionError({ message: "Expected exact zero-tick balance", actual: 1, expected: 0 });
    assert.equal(gate.failure(primary), primary, "The callback is still pending at the first assertion");
    gate.beginCleanup();
    endResponse();
    await operation;
    const combined = gate.failure(primary);
    assert.ok(combined instanceof AggregateError);
    assert.equal(combined.errors[0], primary);
    assert.equal(combined.errors[1].cause, nativeFailure);
    assert.equal(combined.errors[1].startedIn, "scenario");
    assert.equal(combined.errors[1].failedIn, "cleanup");
    assert.match(nativeFailure.cause.code, /^UND_ERR_(?:SOCKET|RES_CONTENT_LENGTH_MISMATCH)$/);
    assert.equal(gate.failure(combined), combined, "Reporting the same failures does not duplicate them");
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise(done => server.close(done));
  }
});
