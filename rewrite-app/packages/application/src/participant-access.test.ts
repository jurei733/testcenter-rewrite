import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import type { ParticipantSession, TestRun } from "@testcenter-rewrite-app/domain";
import { createParticipantAccessService, type ParticipantAccessCredential, type ParticipantAccessRepository } from "./participant-access.js";

const stamp = "2026-10-03T12:00:00.000Z";
const session: ParticipantSession = {
  participantSessionId: "session-a", tenantId: "tenant", workspaceId: "workspace",
  contentReleaseId: "release", loginKey: "login", groupKey: "group", status: "launched", createdAt: stamp
};
const run: TestRun = {
  testRunId: "run-a", participantSessionId: session.participantSessionId,
  tenantId: session.tenantId, workspaceId: session.workspaceId, contentReleaseId: session.contentReleaseId,
  bookletKey: "booklet", status: "running", currentUnitKey: "unit", unitResponses: { unit: "saved answer" },
  createdAt: stamp, updatedAt: stamp, completedAt: null
};
const fixture = (allowLegacySessionIds = true) => {
  let credential: ParticipantAccessCredential | null = null;
  let beforeRevoke = async () => {};
  const repository: ParticipantAccessRepository = {
    async getTestRunById(id) { return id === run.testRunId ? run : null; },
    async getParticipantAccessCredential() { return credential ? { ...credential } : null; },
    async saveParticipantAccessCredential(next) { credential = { ...next }; },
    async revokeParticipantAccessCredential(input) {
      await beforeRevoke();
      if ((credential?.tokenHash ?? null) !== input.expectedTokenHash) return false;
      credential = { participantSessionId: input.participantSessionId, tokenHash: null, updatedAt: input.updatedAt };
      return true;
    }
  };
  const access = createParticipantAccessService({
    repository, allowLegacySessionIds, now: () => stamp, invalidAccess: () => new Error("invalid access"),
    getAccessibleSession: async id => {
      if (id !== session.participantSessionId) throw new Error("missing session");
      return session;
    }
  });
  return { access, repository, beforeRevoke: (hook: typeof beforeRevoke) => { beforeRevoke = hook; } };
};

test("participant credentials are unpredictable and only digests are durable", async () => {
  const { access, repository } = fixture(false);
  const tokens = new Set<string>();
  for (let index = 0; index < 64; index += 1) {
    const token = await access.issueCredential({ participantSessionId: session.participantSessionId });
    assert.match(token, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(tokens.has(token), false);
    tokens.add(token);
    const stored = await repository.getParticipantAccessCredential(session.participantSessionId);
    assert.equal(stored?.tokenHash, createHash("sha256").update(token).digest("hex"));
    assert.equal(JSON.stringify(stored).includes(token), false);
  }
});

test("participant credentials reject missing, invalid and foreign-owner access", async () => {
  const { access } = fixture(false);
  await assert.rejects(access.authorize({ participantSessionId: session.participantSessionId, sessionToken: session.participantSessionId }), /invalid access/);
  const token = await access.issueCredential({ participantSessionId: session.participantSessionId });
  for (const sessionToken of ["", "wrong", token + "a", "a".repeat(257), "🦊".repeat(43)]) {
    await assert.rejects(access.authorize({ testRunId: run.testRunId, sessionToken }), /invalid access/);
  }
  await assert.rejects(access.authorize({ sessionToken: token }), /invalid access/);
  await assert.rejects(access.authorize({ testRunId: "missing-run", sessionToken: token }), /invalid access/);
  await assert.rejects(access.authorize({ participantSessionId: "session-b", testRunId: run.testRunId, sessionToken: token }), /invalid access/);
  assert.deepEqual(await access.authorize({ testRunId: run.testRunId, sessionToken: token }), session);
});

test("participant legacy access ends permanently on first credential issuance", async () => {
  const { access } = fixture();
  const legacy = { participantSessionId: session.participantSessionId, sessionToken: session.participantSessionId };
  assert.deepEqual(await access.authorize(legacy), session);
  const token = await access.issueCredential(legacy);
  await assert.rejects(access.authorize(legacy), /invalid access/);
  assert.equal(await access.revoke({ ...legacy, sessionToken: token }), true);
  await assert.rejects(access.authorize(legacy), /invalid access/);
  await assert.rejects(access.authorize({ ...legacy, sessionToken: token }), /invalid access/);
  const renewed = await access.issueCredential(legacy);
  await assert.rejects(access.authorize({ ...legacy, sessionToken: token }), /invalid access/);
  assert.deepEqual(await access.authorize({ ...legacy, sessionToken: renewed }), session);
  assert.equal(run.unitResponses.unit, "saved answer");
});

test("participant legacy logout writes a tombstone instead of restoring legacy fallback", async () => {
  const { access, repository } = fixture();
  const legacy = { participantSessionId: session.participantSessionId, sessionToken: session.participantSessionId };
  assert.equal(await access.revoke(legacy), true);
  assert.equal((await repository.getParticipantAccessCredential(session.participantSessionId))?.tokenHash, null);
  await assert.rejects(access.authorize(legacy), /invalid access/);
});

test("a delayed participant logout cannot revoke a token issued by a newer login", async () => {
  const fixtureState = fixture();
  const { access } = fixtureState;
  const token = await access.issueCredential({ participantSessionId: session.participantSessionId });
  let releaseRevoke!: () => void;
  let reachedRevoke!: () => void;
  const revokeReached = new Promise<void>(resolve => { reachedRevoke = resolve; });
  const resumeRevoke = new Promise<void>(resolve => { releaseRevoke = resolve; });
  fixtureState.beforeRevoke(async () => { reachedRevoke(); await resumeRevoke; });
  const oldLogout = access.revoke({ participantSessionId: session.participantSessionId, sessionToken: token });
  await revokeReached;
  const newToken = await access.issueCredential({ participantSessionId: session.participantSessionId });
  releaseRevoke();
  assert.equal(await oldLogout, false);
  assert.deepEqual(await access.authorize({ testRunId: run.testRunId, sessionToken: newToken }), session);
  await assert.rejects(access.authorize({ testRunId: run.testRunId, sessionToken: token }), /invalid access/);
});

test("resource capabilities cannot authorize answers, commands, reviews or logout", async () => {
  const { access, repository } = fixture(false);
  const token = await access.issueCredential({ participantSessionId: session.participantSessionId });
  const resourceToken = await access.issueResourceCredential({ testRunId: run.testRunId, sessionToken: token });
  assert.match(resourceToken, /^r1\.[A-Za-z0-9_-]{43}$/);
  assert.equal(resourceToken.includes(token), false);
  assert.equal(JSON.stringify(await repository.getParticipantAccessCredential(session.participantSessionId)).includes(resourceToken), false);
  const resourceAccess = { participantSessionId: session.participantSessionId, resourceToken };
  assert.deepEqual(await access.authorizeResource(resourceAccess), session);
  await assert.rejects(access.authorize({ testRunId: run.testRunId, sessionToken: resourceToken }), /invalid access/);
  await assert.rejects(access.revoke({ participantSessionId: session.participantSessionId, sessionToken: resourceToken }), /invalid access/);
  await assert.rejects(access.issueResourceCredential({ testRunId: run.testRunId, sessionToken: resourceToken }), /invalid access/);
  for (const invalidResourceToken of ["", token, resourceToken + "a", "r1." + "a".repeat(43)]) {
    await assert.rejects(access.authorizeResource({ ...resourceAccess, resourceToken: invalidResourceToken }), /invalid access/);
  }
  await assert.rejects(access.authorizeResource({ ...resourceAccess, participantSessionId: "session-b" }), /invalid access/);
});

test("resource capabilities rotate and revoke with their parent participant credential", async () => {
  const { access } = fixture();
  const legacy = { participantSessionId: session.participantSessionId, sessionToken: session.participantSessionId };
  const legacyResourceToken = await access.issueResourceCredential(legacy);
  const resourceAccess = { participantSessionId: session.participantSessionId, resourceToken: legacyResourceToken };
  assert.deepEqual(await access.authorizeResource(resourceAccess), session);
  const token = await access.issueCredential(legacy);
  await assert.rejects(access.authorizeResource(resourceAccess), /invalid access/);
  const resourceToken = await access.issueResourceCredential({ ...legacy, sessionToken: token });
  assert.notEqual(resourceToken, legacyResourceToken);
  assert.deepEqual(await access.authorizeResource({ ...resourceAccess, resourceToken }), session);
  await access.revoke({ ...legacy, sessionToken: token });
  await assert.rejects(access.authorizeResource({ ...resourceAccess, resourceToken }), /invalid access/);
  await assert.rejects(access.authorizeResource(resourceAccess), /invalid access/);
  const renewed = await access.issueCredential(legacy);
  const renewedResource = await access.issueResourceCredential({ ...legacy, sessionToken: renewed });
  assert.notEqual(renewedResource, resourceToken);
  await assert.rejects(access.authorizeResource({ ...resourceAccess, resourceToken }), /invalid access/);
  assert.deepEqual(await access.authorizeResource({ ...resourceAccess, resourceToken: renewedResource }), session);
});
