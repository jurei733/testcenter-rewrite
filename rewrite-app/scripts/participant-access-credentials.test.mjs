import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
const source = readFileSync(new URL("../apps/web/src/app/participant-access-credentials.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
});
const access = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const storage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values };
};
const first = "a".repeat(43), second = "b".repeat(43);

test("participant credentials remain scoped to the exact run owner across rotation and re-entry", () => {
  const store = storage();
  assert.equal(access.readParticipantSessionCredential("session-a", store), "session-a");
  assert.equal(access.readParticipantRunCredential("unknown-run", store), null);
  assert.equal(access.rememberParticipantRunOwner("run-a", "session-a", store), true);
  assert.equal(access.readParticipantRunCredential("run-a", store), "session-a");
  assert.equal(access.rememberParticipantSessionCredential("session-a", first, store), true);
  access.rememberParticipantRunOwner("run-b", "session-b", store);
  access.rememberParticipantSessionCredential("session-b", second, store);
  assert.equal(access.readParticipantRunCredential("run-a", store), first);
  assert.equal(access.readParticipantRunCredential("run-b", store), second);
  assert.equal(access.rememberParticipantRunOwner("run-a", "session-b", store), false);
  access.rememberParticipantSessionCredential("session-a", second, store);
  assert.equal(access.readParticipantRunCredential("run-a", store), second);
});

test("confirmed participant logout preserves responses and owners but prevents local legacy fallback", () => {
  const store = storage();
  store.setItem("pending-responses", "saved answer and delivery ID");
  access.rememberParticipantSessionCredential("session-a", first, store);
  access.rememberParticipantRunOwner("run-a", "session-a", store);
  assert.equal(access.forgetParticipantSessionCredential("session-a", store), true);
  assert.equal(access.readParticipantSessionCredential("session-a", store), null);
  assert.equal(access.readParticipantRunCredential("run-a", store), null);
  assert.equal(store.getItem("pending-responses"), "saved answer and delivery ID");
  access.rememberParticipantSessionCredential("session-a", second, store);
  assert.equal(access.readParticipantRunCredential("run-a", store), second);
});

test("stale local logout cannot erase a renewed participant credential", () => {
  const store = storage();
  access.rememberParticipantSessionCredential("session-a", second, store);
  const before = store.getItem(access.PARTICIPANT_ACCESS_STORAGE_KEY);
  assert.equal(access.forgetParticipantSessionCredential("session-a", store, first), false);
  assert.equal(store.getItem(access.PARTICIPANT_ACCESS_STORAGE_KEY), before);
  assert.equal(access.forgetParticipantSessionCredential("session-a", store, second), true);
  assert.equal(access.readParticipantSessionCredential("session-a", store), null);
});

test("participant storage rejects malformed data, resource tokens and conflicting identities", () => {
  const store = storage();
  for (const invalid of ["", "r1." + first, "a".repeat(257), null]) {
    assert.equal(access.rememberParticipantSessionCredential("session-a", invalid, store), false);
  }
  for (const raw of ["broken", "null", '{"version":999}', JSON.stringify({ version: 1, sessions: [["a", first], ["a", second]], runs: [] })]) {
    store.setItem(access.PARTICIPANT_ACCESS_STORAGE_KEY, raw);
    assert.equal(access.readParticipantRunCredential("run-a", store), null);
  }
  assert.equal(access.rememberParticipantRunOwner("run/invalid", "session-a", store), false);
  assert.equal(access.rememberParticipantSessionCredential("session a", first, store), false);
});

test("participant credential capacity and failed writes do not evict other sessions or answers", () => {
  const store = storage();
  for (let index = 0; index < 500; index++) assert.equal(access.rememberParticipantSessionCredential(`session-${index}`, first, store), true);
  const before = store.getItem(access.PARTICIPANT_ACCESS_STORAGE_KEY);
  assert.equal(access.rememberParticipantSessionCredential("extra-session", second, store), false);
  assert.equal(store.getItem(access.PARTICIPANT_ACCESS_STORAGE_KEY), before);
  assert.equal(access.rememberParticipantSessionCredential("session-0", second, store), true);
  assert.equal(access.readParticipantSessionCredential("session-0", store), second);
  const blocked = { getItem: store.getItem, setItem() { throw new Error("quota"); } };
  assert.equal(access.forgetParticipantSessionCredential("session-0", blocked), false);
  assert.equal(access.readParticipantSessionCredential("session-0", store), second);
});

test("participant request selection uses the owner credential and never selects an operator secret", () => {
  const store = storage();
  assert.equal(access.rememberParticipantAccessResponse('/api/v1/admin/auth/sign-in', {
    sessionToken: first, participantSession: { participantSessionId: 'session-a' }
  }, store), true);
  assert.equal(store.values.size, 0);
  assert.equal(access.rememberParticipantAccessResponse('/api/v1/participant/auth/sign-in', {
    sessionToken: first, participantSession: { participantSessionId: 'session-a' }
  }, store), true);
  assert.equal(access.rememberParticipantAccessResponse('/api/v1/participant/sessions/session-a/current-state', {
    currentRunState: { participantSession: { participantSessionId: 'session-a' }, testRun: { testRunId: 'run-a', participantSessionId: 'session-a' } }
  }, store), true);
  assert.equal(access.participantRequestToken('/api/v1/participant/sessions/session-a/events', undefined, store), first);
  assert.equal(access.participantRequestToken('/api/v1/participant/test-runs/run-a/save-progress', undefined, store), first);
  assert.equal(access.participantRequestToken('/api/v1/participant/starter:launch', { participantSessionId: 'session-a' }, store), first);
  assert.equal(access.participantRequestToken('/api/v1/participant/starter:launch', { loginKey: 'login' }, store), null);
  assert.equal(access.participantRequestToken('/api/v1/participant/auth/sign-in', undefined, store), null);
  assert.equal(access.participantRequestToken('/api/v1/participant/sessions/%xx/events', undefined, store), null);
  assert.equal(access.rememberParticipantAccessResponse('/api/v1/participant/starter:launch', {
    participantSession: { participantSessionId: 'session-a' }, testRun: { testRunId: 'run-conflict', participantSessionId: 'session-b' }
  }, store), false);
});
