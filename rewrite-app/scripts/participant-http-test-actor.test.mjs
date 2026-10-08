import assert from "node:assert/strict";
import { test } from "node:test";
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
