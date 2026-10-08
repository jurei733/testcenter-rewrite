import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
const { outputText } = ts.transpileModule(readFileSync(new URL("../apps/web/src/app/participant-sign-out.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
});
const { performParticipantSignOut } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const createHost = () => {
  let credential = "first-token", cleared = false;
  const answers = { response: "exact answer", deliveryId: "exact delivery ID" };
  return {
    participantSessionId: "session-a", readCredential: () => credential,
    revoke: async (id, token) => { assert.equal(id, "session-a"); assert.equal(token, "first-token"); },
    forgetCredential: (id, expected) => { assert.equal(id, "session-a"); assert.equal(expected, credential); credential = null; return true; },
    clearSignedInState: () => { cleared = true; },
    renew: () => { credential = "renewed-token"; },
    state: () => ({ credential, cleared, answers })
  };
};

test("participant logout waits for server confirmation and preserves pending answer bytes and delivery identity", async () => {
  const host = createHost();
  let confirm;
  const pending = new Promise(resolve => { confirm = resolve; });
  host.revoke = async () => pending;
  const signingOut = performParticipantSignOut(host);
  assert.equal(host.state().cleared, false);
  confirm();
  assert.equal(await signingOut, "signed_out");
  assert.deepEqual(host.state(), { credential: null, cleared: true, answers: { response: "exact answer", deliveryId: "exact delivery ID" } });
});

test("failed participant logout keeps the credential, visible session and queued answers for retry", async () => {
  const host = createHost();
  const before = host.state();
  host.revoke = async () => { throw new Error("network unavailable"); };
  await assert.rejects(performParticipantSignOut(host), /network unavailable/);
  assert.deepEqual(host.state(), before);
});

test("login renewal during participant logout is never erased by a stale completion", async () => {
  const host = createHost();
  host.revoke = async () => host.renew();
  assert.equal(await performParticipantSignOut(host), "renewed");
  assert.equal(host.state().credential, "renewed-token");
  assert.equal(host.state().cleared, false);
});

test("a local quota failure cannot keep a server-revoked session visible", async () => {
  const host = createHost();
  host.forgetCredential = () => false;
  assert.equal(await performParticipantSignOut(host), "signed_out");
  assert.equal(host.state().cleared, true);
  assert.equal(host.state().answers.response, "exact answer");
});

test("a credential renewed during local compare-and-forget remains signed in", async () => {
  const host = createHost();
  host.forgetCredential = () => { host.renew(); return false; };
  assert.equal(await performParticipantSignOut(host), "renewed");
  assert.equal(host.state().credential, "renewed-token");
  assert.equal(host.state().cleared, false);
});

test("a stale logout cannot clear a different participant opened while revocation was pending", async () => {
  const host = createHost();
  host.readActiveSessionId = () => "session-b";
  assert.equal(await performParticipantSignOut(host), "replaced");
  assert.equal(host.state().credential, null);
  assert.equal(host.state().cleared, false);
  assert.equal(host.state().answers.response, "exact answer");
});

test("logout without a participant credential never invokes revocation or clears the view", async () => {
  const host = createHost();
  host.readCredential = () => null;
  host.revoke = () => assert.fail("must not call the server without participant access");
  await assert.rejects(performParticipantSignOut(host), /access is unavailable/);
  assert.equal(host.state().cleared, false);
});
