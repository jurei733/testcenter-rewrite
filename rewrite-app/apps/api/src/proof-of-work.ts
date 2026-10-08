import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual
} from "node:crypto";

import {
  FirstSliceError,
  type FirstSliceRepository
} from "@testcenter-rewrite-app/application";
import type {
  AdminSignInCredentials,
  CreateProofOfWorkChallengeRequest,
  CreateProofOfWorkChallengeResponse,
  ParticipantSignInCredentials,
  ProofOfWorkScope,
  ProofOfWorkSolution
} from "@testcenter-rewrite-app/contracts";

export type ProofOfWorkConfig = {
  enabledScopes: ProofOfWorkScope[];
  maxNumber: number;
  ttlMs: number;
  currentSecret: string | null;
  previousSecret: string | null;
};

type ProofOfWorkTokenPayload = {
  version: 1;
  challengeId: string;
  scope: ProofOfWorkScope;
  algorithm: "SHA-256";
  challenge: string;
  salt: string;
  maxNumber: number;
  issuedAtMs: number;
  expiresAtMs: number;
  inputDigest: string;
  keyId: string;
};

type ProofOfWorkCredentials =
  | AdminSignInCredentials
  | ParticipantSignInCredentials;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasOptionalString = (
  value: Record<string, unknown>,
  key: string
): boolean => value[key] === undefined || typeof value[key] === "string";

const validateCredentials = (
  scope: ProofOfWorkScope,
  value: unknown
): value is ProofOfWorkCredentials => {
  if (!isRecord(value)) {
    return false;
  }
  if (scope === "admin") {
    return (
      typeof value.username === "string" && typeof value.password === "string"
    );
  }
  return (
    typeof value.loginKey === "string" &&
    hasOptionalString(value, "tenantKey") &&
    hasOptionalString(value, "workspaceKey") &&
    hasOptionalString(value, "groupKey") &&
    hasOptionalString(value, "password") &&
    hasOptionalString(value, "participantCode")
  );
};

const createKeyId = (secret: string): string =>
  createHash("sha256").update(secret, "utf8").digest("hex").slice(0, 32);

const normalizeOptional = (value: string | undefined): string =>
  value?.trim() ?? "";

const canonicalizeCredentials = (
  scope: ProofOfWorkScope,
  credentials: ProofOfWorkCredentials
): string => {
  if (scope === "admin") {
    const adminCredentials = credentials as AdminSignInCredentials;
    return JSON.stringify({
      scope,
      username: adminCredentials.username.trim().toLowerCase(),
      password: adminCredentials.password
    });
  }

  const participantCredentials = credentials as ParticipantSignInCredentials;
  const identity = {
    tenantKey: normalizeOptional(participantCredentials.tenantKey),
    workspaceKey: normalizeOptional(participantCredentials.workspaceKey),
    loginKey: participantCredentials.loginKey.trim(),
    groupKey: normalizeOptional(participantCredentials.groupKey)
  };
  return JSON.stringify(
    scope === "participant"
      ? {
          scope,
          ...identity,
          password: participantCredentials.password ?? ""
        }
      : {
          scope,
          ...identity,
          participantCode: normalizeOptional(
            participantCredentials.participantCode
          )
        }
  );
};

const credentialsContainProtectedSecret = (
  scope: ProofOfWorkScope,
  credentials: ProofOfWorkCredentials
): boolean => {
  if (scope === "admin") {
    return (credentials as AdminSignInCredentials).username.trim() !== "";
  }
  const participantCredentials = credentials as ParticipantSignInCredentials;
  return scope === "participant"
    ? participantCredentials.loginKey.trim() !== ""
    : normalizeOptional(participantCredentials.participantCode) !== "";
};

const createCredentialDigest = (
  secret: string,
  scope: ProofOfWorkScope,
  credentials: ProofOfWorkCredentials
): string =>
  createHmac("sha256", secret)
    .update(canonicalizeCredentials(scope, credentials), "utf8")
    .digest("base64url");

const safeEqual = (left: string, right: string): boolean => {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return (
    leftBytes.byteLength === rightBytes.byteLength &&
    timingSafeEqual(leftBytes, rightBytes)
  );
};

const isProofOfWorkScope = (value: unknown): value is ProofOfWorkScope =>
  value === "admin" || value === "participant" || value === "second_code";

const parseTokenPayload = (token: string): {
  payload: ProofOfWorkTokenPayload;
  payloadSegment: string;
  signature: string;
} | null => {
  const [payloadSegment, signature, extra] = token.split(".");
  if (!payloadSegment || !signature || extra !== undefined) {
    return null;
  }
  try {
    const candidate = JSON.parse(
      Buffer.from(payloadSegment, "base64url").toString("utf8")
    ) as Partial<ProofOfWorkTokenPayload>;
    if (
      candidate.version !== 1 ||
      typeof candidate.challengeId !== "string" ||
      !isProofOfWorkScope(candidate.scope) ||
      candidate.algorithm !== "SHA-256" ||
      typeof candidate.challenge !== "string" ||
      typeof candidate.salt !== "string" ||
      typeof candidate.maxNumber !== "number" ||
      !Number.isSafeInteger(candidate.maxNumber) ||
      typeof candidate.issuedAtMs !== "number" ||
      !Number.isSafeInteger(candidate.issuedAtMs) ||
      typeof candidate.expiresAtMs !== "number" ||
      !Number.isSafeInteger(candidate.expiresAtMs) ||
      typeof candidate.inputDigest !== "string" ||
      typeof candidate.keyId !== "string"
    ) {
      return null;
    }
    return {
      payload: candidate as ProofOfWorkTokenPayload,
      payloadSegment,
      signature
    };
  } catch {
    return null;
  }
};

export class ProofOfWorkManager {
  readonly publicConfig: {
    enabledScopes: ProofOfWorkScope[];
    algorithm: "SHA-256";
    maxNumber: number;
    ttlMs: number;
    currentKeyId: string | null;
    previousKeyConfigured: boolean;
  };

  private readonly enabledScopes: ReadonlySet<ProofOfWorkScope>;
  private readonly currentSecret: string | null;
  private readonly secretsByKeyId = new Map<string, string>();

  constructor(
    private readonly repository: FirstSliceRepository,
    private readonly config: ProofOfWorkConfig,
    private readonly now: () => number = Date.now
  ) {
    this.enabledScopes = new Set(config.enabledScopes);
    this.currentSecret = config.currentSecret;
    if (config.currentSecret) {
      this.secretsByKeyId.set(createKeyId(config.currentSecret), config.currentSecret);
    }
    if (config.previousSecret) {
      this.secretsByKeyId.set(
        createKeyId(config.previousSecret),
        config.previousSecret
      );
    }
    this.publicConfig = {
      enabledScopes: [...config.enabledScopes],
      algorithm: "SHA-256",
      maxNumber: config.maxNumber,
      ttlMs: config.ttlMs,
      currentKeyId: config.currentSecret
        ? createKeyId(config.currentSecret)
        : null,
      previousKeyConfigured: Boolean(config.previousSecret)
    };
  }

  isRequired(
    scope: ProofOfWorkScope,
    credentials: ProofOfWorkCredentials
  ): boolean {
    return (
      this.enabledScopes.has(scope) &&
      validateCredentials(scope, credentials) &&
      credentialsContainProtectedSecret(scope, credentials)
    );
  }

  createChallenge(
    request: CreateProofOfWorkChallengeRequest
  ): CreateProofOfWorkChallengeResponse {
    if (
      !isRecord(request) ||
      !isProofOfWorkScope(request.scope) ||
      !validateCredentials(request.scope, request.credentials)
    ) {
      throw new FirstSliceError(
        400,
        "proof_of_work_request_invalid",
        "A valid proof-of-work scope and matching credentials are required."
      );
    }
    if (!this.enabledScopes.has(request.scope)) {
      throw new FirstSliceError(
        409,
        "proof_of_work_scope_disabled",
        `Proof of work is not enabled for scope '${request.scope}'.`,
        { scope: request.scope }
      );
    }
    if (!this.currentSecret) {
      throw new FirstSliceError(
        503,
        "proof_of_work_unavailable",
        "Proof of work is enabled but no current signing secret is available."
      );
    }
    if (!credentialsContainProtectedSecret(request.scope, request.credentials)) {
      throw new FirstSliceError(
        400,
        "proof_of_work_credentials_missing",
        `Protected credentials are required for scope '${request.scope}'.`,
        { scope: request.scope }
      );
    }

    const issuedAtMs = this.now();
    const expiresAtMs = issuedAtMs + this.config.ttlMs;
    const salt = randomBytes(12).toString("hex");
    const number = randomInt(this.config.maxNumber + 1);
    const challenge = createHash("sha256")
      .update(`${salt}${number}`, "utf8")
      .digest("hex");
    const keyId = createKeyId(this.currentSecret);
    const payload: ProofOfWorkTokenPayload = {
      version: 1,
      challengeId: randomUUID(),
      scope: request.scope,
      algorithm: "SHA-256",
      challenge,
      salt,
      maxNumber: this.config.maxNumber,
      issuedAtMs,
      expiresAtMs,
      inputDigest: createCredentialDigest(
        this.currentSecret,
        request.scope,
        request.credentials
      ),
      keyId
    };
    const payloadSegment = Buffer.from(JSON.stringify(payload), "utf8").toString(
      "base64url"
    );
    const signature = createHmac("sha256", this.currentSecret)
      .update(payloadSegment, "utf8")
      .digest("base64url");

    return {
      algorithm: "SHA-256",
      challenge,
      salt,
      maxNumber: this.config.maxNumber,
      expiresAt: new Date(expiresAtMs).toISOString(),
      token: `${payloadSegment}.${signature}`
    };
  }

  async verify(
    scope: ProofOfWorkScope,
    credentials: ProofOfWorkCredentials,
    solution: ProofOfWorkSolution | undefined
  ): Promise<void> {
    if (!this.enabledScopes.has(scope)) {
      return;
    }
    if (!validateCredentials(scope, credentials)) {
      throw new FirstSliceError(
        400,
        "proof_of_work_request_invalid",
        "Valid credentials are required to verify proof of work.",
        { scope }
      );
    }
    if (!credentialsContainProtectedSecret(scope, credentials)) {
      return;
    }
    if (!solution) {
      throw new FirstSliceError(
        400,
        "proof_of_work_required",
        `A solved proof-of-work challenge is required for scope '${scope}'.`,
        { scope }
      );
    }
    if (
      !isRecord(solution) ||
      typeof solution.token !== "string" ||
      typeof solution.number !== "number"
    ) {
      this.throwInvalid(scope);
    }
    const parsed = parseTokenPayload(solution.token);
    if (!parsed || parsed.payload.scope !== scope) {
      this.throwInvalid(scope);
    }
    const { payload, payloadSegment, signature } = parsed;
    const secret = this.secretsByKeyId.get(payload.keyId);
    if (!secret) {
      this.throwInvalid(scope);
    }
    const expectedSignature = createHmac("sha256", secret)
      .update(payloadSegment, "utf8")
      .digest("base64url");
    if (!safeEqual(signature, expectedSignature)) {
      this.throwInvalid(scope);
    }
    const timestampMs = this.now();
    if (payload.expiresAtMs <= timestampMs) {
      throw new FirstSliceError(
        400,
        "proof_of_work_expired",
        "The proof-of-work challenge has expired.",
        { scope, expiresAt: new Date(payload.expiresAtMs).toISOString() }
      );
    }
    if (
      payload.issuedAtMs > timestampMs + 5_000 ||
      payload.expiresAtMs - payload.issuedAtMs !== this.config.ttlMs ||
      payload.maxNumber !== this.config.maxNumber ||
      !Number.isSafeInteger(solution.number) ||
      solution.number < 0 ||
      solution.number > payload.maxNumber
    ) {
      this.throwInvalid(scope);
    }
    const expectedInputDigest = createCredentialDigest(
      secret,
      scope,
      credentials
    );
    const solvedChallenge = createHash("sha256")
      .update(`${payload.salt}${solution.number}`, "utf8")
      .digest("hex");
    if (
      !safeEqual(payload.inputDigest, expectedInputDigest) ||
      !safeEqual(payload.challenge, solvedChallenge)
    ) {
      this.throwInvalid(scope);
    }
    const consumed = await this.repository.consumeProofOfWorkChallenge({
      challengeId: payload.challengeId,
      consumedAt: new Date(timestampMs).toISOString(),
      expiresAt: new Date(payload.expiresAtMs).toISOString()
    });
    if (!consumed) {
      throw new FirstSliceError(
        409,
        "proof_of_work_replayed",
        "The proof-of-work challenge has already been used.",
        { scope }
      );
    }
  }

  private throwInvalid(scope: ProofOfWorkScope): never {
    throw new FirstSliceError(
      400,
      "proof_of_work_invalid",
      "The proof-of-work challenge or solution is invalid.",
      { scope }
    );
  }
}
