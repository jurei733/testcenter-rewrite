import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import type { ParticipantSession, TestRun } from "@testcenter-rewrite-app/domain";

export type ParticipantAccessCredential = {
  participantSessionId: string;
  /** Only a digest is durable. A null digest is a revocation tombstone, not a legacy session. */
  tokenHash: string | null;
  updatedAt: string;
};

export type ParticipantAccessRepository = {
  getParticipantAccessCredential(
    participantSessionId: string
  ): Promise<ParticipantAccessCredential | null>;
  saveParticipantAccessCredential(
    credential: ParticipantAccessCredential
  ): Promise<void>;
  /** Compare-and-revoke: a stale logout must not invalidate a newer login. */
  revokeParticipantAccessCredential(input: {
    participantSessionId: string;
    expectedTokenHash: string | null;
    updatedAt: string;
  }): Promise<boolean>;
  getTestRunById(testRunId: string): Promise<TestRun | null>;
};

export type ParticipantAccessInput = {
  participantSessionId?: string;
  testRunId?: string;
  sessionToken: string;
};

export type ParticipantAccessPort = {
  /** Trusted login operation; never expose credential issuance by session ID alone. */
  issueCredential(input: { participantSessionId: string }): Promise<string>;
  authorize(input: ParticipantAccessInput): Promise<ParticipantSession>;
  revoke(input: {
    participantSessionId: string;
    sessionToken: string;
  }): Promise<boolean>;
};

export function createParticipantAccessService(input: {
  repository: ParticipantAccessRepository;
  getAccessibleSession: (participantSessionId: string) => Promise<ParticipantSession>;
  invalidAccess: () => Error;
  now: () => string;
  /** Migration only: an old opaque session ID works until its first credential issuance/revocation. */
  allowLegacySessionIds: boolean;
}): ParticipantAccessPort {
  const hash = (token: string) => createHash("sha256").update(token).digest("hex");
  const matches = (actual: string, expected: string) => {
    const actualBytes = Buffer.from(actual);
    const expectedBytes = Buffer.from(expected);
    return (
      actualBytes.length === expectedBytes.length &&
      timingSafeEqual(actualBytes, expectedBytes)
    );
  };
  const authorize = async (access: ParticipantAccessInput) => {
    const token = access.sessionToken;
    if (typeof token !== "string" || !token || token.length > 256) {
      throw input.invalidAccess();
    }
    const run = access.testRunId
      ? await input.repository.getTestRunById(access.testRunId)
      : null;
    if (access.testRunId && !run) throw input.invalidAccess();
    const participantSessionId =
      access.participantSessionId?.trim() || run?.participantSessionId;
    if (
      !participantSessionId ||
      (run && run.participantSessionId !== participantSessionId)
    ) {
      throw input.invalidAccess();
    }
    const credential =
      await input.repository.getParticipantAccessCredential(participantSessionId);
    const validToken = credential
      ? Boolean(credential.tokenHash && matches(hash(token), credential.tokenHash))
      : input.allowLegacySessionIds && matches(token, participantSessionId);
    if (!validToken) {
      throw input.invalidAccess();
    }
    const session = await input.getAccessibleSession(participantSessionId);
    return { session, credential };
  };
  return {
    async issueCredential({ participantSessionId }) {
      await input.getAccessibleSession(participantSessionId);
      const token = randomBytes(32).toString("base64url");
      await input.repository.saveParticipantAccessCredential({
        participantSessionId,
        tokenHash: hash(token),
        updatedAt: input.now()
      });
      return token;
    },
    async authorize(access) {
      return (await authorize(access)).session;
    },
    async revoke(access) {
      const { session, credential } = await authorize(access);
      return input.repository.revokeParticipantAccessCredential({
        participantSessionId: session.participantSessionId,
        expectedTokenHash: credential?.tokenHash ?? null,
        updatedAt: input.now()
      });
    }
  };
}
