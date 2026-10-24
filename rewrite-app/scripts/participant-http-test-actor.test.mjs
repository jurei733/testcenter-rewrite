import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:net";
import { runInNewContext } from "node:vm";
import { createParticipantHttpTestActor } from "./participant-http-test-actor.mjs";

test("HTTP test actors retain real owner credentials without overriding explicit denial cases", async () => {
  const requests = [];
  const first = "a".repeat(43), second = "b".repeat(43);
  const root = "http://127.0.0.1:9999";
  const actor = createParticipantHttpTestActor(async (url, init) => {
    requests.push({ url, token: init.headers.get("authorization") });
    const payload = url.endsWith("/auth/sign-in")
      ? { sessionToken: requests.length === 1 ? first : second, participantSession: { participantSessionId: "session-a" } }
      : { testRun: { testRunId: "run-a", participantSessionId: "session-a" } };
    return Response.json(payload);
  });
  await actor.fetch(root + "/api/v1/participant/auth/sign-in");
  assert.equal(requests[0].token, null);
  await actor.fetch(root + "/api/v1/participant/sessions/session-a/resume", { method: "POST" });
  assert.equal(requests[1].token, `Bearer ${first}`);
  await actor.fetch(root + "/api/v1/participant/test-runs/run-a/save-progress");
  assert.equal(requests[2].token, `Bearer ${first}`);
  await actor.fetch(root + "/api/v1/participant/test-runs/run-a/save-progress", { headers: { authorization: "Bearer foreign-or-admin" } });
  assert.equal(requests[3].token, "Bearer foreign-or-admin");
  await actor.fetch(root + "/api/v1/admin/auth/sign-in");
  assert.equal(requests[4].token, null);
  await actor.fetch(root + "/api/v1/participant/auth/sign-in");
  assert.equal(actor.headers(root + "/api/v1/participant/test-runs/run-a/reviews").authorization, `Bearer ${second}`);
  assert.deepEqual(actor.headers("http://127.0.0.1:9998/api/v1/participant/test-runs/run-a/reviews"), {});
});

test("HTTP test actors never learn credentials from denied responses", async () => {
  const actor = createParticipantHttpTestActor(async () => Response.json({
    sessionToken: "a".repeat(43), participantSession: { participantSessionId: "session-a" },
    testRun: { testRunId: "run-a", participantSessionId: "session-a" }
  }, { status: 401 }));
  const url = "http://127.0.0.1:9999/api/v1/participant/auth/sign-in";
  assert.equal((await actor.fetch(url)).status, 401);
  assert.deepEqual(actor.headers("http://127.0.0.1:9999/api/v1/participant/test-runs/run-a/reviews"), {});
});

test("synthetic browser fixture bootstrap uses an issued token and preserves existing keys, tombstones and answers", async () => {
  const token = "a".repeat(43);
  const actor = createParticipantHttpTestActor(async () => Response.json({
    sessionToken: token, participantSession: { participantSessionId: "session-a" },
    testRun: { testRunId: "run-a", participantSessionId: "session-a" }
  }));
  const root = "http://127.0.0.1:9999";
  await actor.fetch(root + "/api/v1/participant/auth/sign-in");
  const values = new Map([["pending-answers", "exact response and delivery ID"]]);
  const scripts = [];
  const page = {
    on() {}, async goto(url) { return url; },
    async addInitScript(fn, args) { scripts.push({ fn, args }); }
  };
  await actor.goto(page, root + "/app/participant?loginKey=fixture");
  await actor.goto(page, root + "/app/participant?participantSessionId=unknown");
  assert.equal(scripts.length, 0);
  await actor.goto(page, root + "/app/participant?participantSessionId=session-a");
  assert.equal(scripts.length, 1);
  const execute = () => runInNewContext(`(${scripts[0].fn.toString()})(args)`, {
    args: scripts[0].args, location: { origin: root },
    localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  });
  execute();
  const key = "testcenter-rewrite:participant-access:v1";
  assert.deepEqual(JSON.parse(values.get(key)), { version: 1, sessions: [["session-a", token]], runs: [["run-a", "session-a"]] });
  for (const retained of ["b".repeat(43), null]) {
    const state = JSON.stringify({ version: 1, sessions: [["session-a", retained]], runs: [["run-a", "session-a"]] });
    values.set(key, state);
    execute();
    assert.equal(values.get(key), state);
  }
  assert.equal(values.get("pending-answers"), "exact response and delivery ID");
});

test("fixture HTTP calls await existing credential captures without chasing later browser traffic", async () => {
  let responseListener, resolveExisting, resolveLater;
  const existing = new Promise(done => { resolveExisting = done; });
  const later = new Promise(done => { resolveLater = done; });
  const token = "a".repeat(43), requests = [];
  const actor = createParticipantHttpTestActor(async (url, init) => {
    requests.push(init.headers.get("authorization")); return Response.json({});
  });
  actor.observePage({ on(name, callback) { if (name === "response") responseListener = callback; } });
  const response = (path, body) => ({ ok: () => true,
    url: () => "http://127.0.0.1:9999/api/v1/participant/" + path,
    headers: () => ({ "content-type": "application/json" }),
    request: () => ({ headers: () => ({}) }), json: () => body });
  responseListener(response("auth/sign-in", existing));
  const request = actor.fetch("http://127.0.0.1:9999/api/v1/participant/sessions/session-a/resume");
  assert.equal(requests.length, 0, "The already-issued credential must be captured first");
  responseListener(response("sessions/other/current-state", later));
  resolveExisting({ sessionToken: token, participantSession: { participantSessionId: "session-a" } });
  try {
    await new Promise(done => setImmediate(done));
    assert.deepEqual([...requests], [`Bearer ${token}`], "Later unrelated traffic cannot extend the credential barrier");
    await request;
  } finally {
    resolveLater({}); await request;
  }
});

test("an unfinished browser body fails credential capture with a bounded secret-free diagnostic", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let responseListener, resolveBody;
  const body = new Promise(done => { resolveBody = done; });
  const requests = [], token = "a".repeat(43);
  const actor = createParticipantHttpTestActor(async (url, init) => {
    requests.push(init.headers.get("authorization")); return Response.json({});
  });
  actor.observePage({ on(name, callback) { if (name === "response") responseListener = callback; } });
  responseListener({ ok: () => true,
    url: () => `http://127.0.0.1:9999/api/v1/participant/auth/sign-in?password=${token}`,
    headers: () => ({ "content-type": "application/json" }),
    request: () => ({ headers: () => ({ authorization: `Bearer ${token}` }) }), json: () => body });
  const pending = actor.fetch("http://127.0.0.1:9999/api/v1/participant/sessions/session-a/resume");
  const rejected = assert.rejects(pending, error => {
    assert.equal(error.message, "Participant fixture credential capture timed out: /api/v1/participant/auth/sign-in");
    assert.ok(!error.message.includes(token)); return true;
  });
  t.mock.timers.tick(30_000);
  await rejected;
  assert.deepEqual(requests, [], "Timeout must fail before issuing a request with guessed credentials");
  resolveBody({ sessionToken: token, participantSession: { participantSessionId: "session-a" } });
  await new Promise(done => setImmediate(done));
  await actor.fetch("http://127.0.0.1:9999/api/v1/participant/sessions/session-a/resume");
  assert.deepEqual(requests, [`Bearer ${token}`]);
});

test("a real malformed chunked JSON response remains a protocol failure with a safe owning path", async () => {
  const sockets = new Set();
  const server = createServer(socket => {
    sockets.add(socket); socket.once("close", () => sockets.delete(socket));
    socket.once("data", () => {
      socket.write("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n");
      setTimeout(() => socket.end("not-a-hex-chunk\r\n{}\r\n0\r\n\r\n"), 25);
    });
  });
  await new Promise(done => server.listen(0, "127.0.0.1", done));
  const actor = createParticipantHttpTestActor();
  try {
    await assert.rejects(actor.fetch(`http://127.0.0.1:${server.address().port}/api/v1/participant/sessions/owned/current-state?token=must-not-appear`), error => {
      assert.match(error.message, /^Participant fixture GET \/api\/v1\/participant\/sessions\/owned\/current-state JSON capture failed$/);
      assert.ok(!error.message.includes("must-not-appear"));
      assert.equal(error.cause.cause.code, "HPE_INVALID_CHUNK_SIZE");
      assert.deepEqual(actor.headers(`http://127.0.0.1:${server.address().port}/api/v1/participant/test-runs/foreign/save-progress`), {});
      return true;
    });
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise(done => server.close(done));
  }
});
