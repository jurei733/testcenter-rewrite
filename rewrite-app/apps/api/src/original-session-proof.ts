import {createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual} from 'node:crypto';
import {FirstSliceError, type FirstSliceRepository} from '@testcenter-rewrite-app/application';
import type {ProofOfWorkConfig} from './proof-of-work.js';

export type OriginalProofTarget = {kind: 'login'; name: string; password: string} | {kind: 'person'; code: string; tokenHash: string};
import type {OriginalWorkChallenge} from '@testcenter-rewrite-app/contracts/original-session';
export type {OriginalWorkChallenge} from '@testcenter-rewrite-app/contracts/original-session';
type Ticket = OriginalProofTarget & {version: 1; challengeId: string; issuedAt: number; expiresAt: number; maxNumber: number};
type OriginalProofConfig = ProofOfWorkConfig & {maxJsonBodyBytes?: number};
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const bounded = (value: unknown, maximum: number): value is string => typeof value === 'string' && value.length <= maximum;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const equal = (left: string, right: string) => left.length === right.length && timingSafeEqual(Buffer.from(left), Buffer.from(right));
const keyId = (secret: string) => hash(secret).slice(0, 32);
const sealKey = (secret: string) => createHash('sha256').update('testcenter-original-session-seal:v1\0').update(secret).digest();
const aad = Buffer.from('testcenter-original-session-ticket:v1');
const invalid = () => new FirstSliceError(400, 'original_work_invalid', 'Wrong challenge response');
const targetValid = (value: unknown, maximum: number): value is OriginalProofTarget => record(value) &&
  (value.kind === 'login' ? bounded(value.name, maximum) && value.name.length > 0 && bounded(value.password, maximum)
    : value.kind === 'person' && bounded(value.code, maximum) && typeof value.tokenHash === 'string' && /^[0-9a-f]{64}$/.test(value.tokenHash));
const ticketValid = (value: unknown, maximum: number): value is Ticket => record(value) && value.version === 1 &&
  typeof value.challengeId === 'string' && /^[0-9a-f-]{36}$/.test(value.challengeId) &&
  typeof value.issuedAt === 'number' && Number.isSafeInteger(value.issuedAt) &&
  typeof value.expiresAt === 'number' && Number.isSafeInteger(value.expiresAt) &&
  typeof value.maxNumber === 'number' && Number.isSafeInteger(value.maxNumber) && targetValid(value, maximum);

/** Source's five-field ALTCHA client contract, with an authenticated encrypted
 * credential ticket, expiry, durable one-use claim and exact Login-token binding.
 * Neither challenge JSON nor its salt exposes a password or person code. */
export class OriginalSessionProof {
  private readonly keys = new Map<string, string>();
  private readonly config: ProofOfWorkConfig;
  private readonly maxWireBytes: number;
  constructor(private readonly repository: Pick<FirstSliceRepository, 'consumeProofOfWorkChallenge'>,
    config: OriginalProofConfig, private readonly now: () => number = Date.now) {
    this.config = {...config, enabledScopes: [...config.enabledScopes]};
    this.maxWireBytes = config.maxJsonBodyBytes ?? 1_048_576;
    for (const secret of [config.currentSecret, config.previousSecret]) if (secret) this.keys.set(keyId(secret), secret);
  }
  static tokenHash(token: string): string { return hash(token); }
  directAllowed(kind: 'login' | 'person', protectedInput: string): void {
    const scope = kind === 'login' ? 'participant' : 'second_code';
    if (this.config.enabledScopes.includes(scope) && protectedInput !== '') {
      throw new FirstSliceError(400, 'original_work_required', 'Brute Force protection active. Challenge must be solved to create a session');
    }
  }
  create(target: OriginalProofTarget): OriginalWorkChallenge {
    if (!targetValid(target, this.maxWireBytes)) throw invalid();
    const secret = this.config.currentSecret;
    if (!secret) throw new FirstSliceError(503, 'original_work_unavailable', 'Challenge protection is unavailable.');
    const issuedAt = this.now(), iv = randomBytes(12);
    const ticket: Ticket = {...structuredClone(target), version: 1, challengeId: randomUUID(), issuedAt,
      expiresAt: issuedAt + this.config.ttlMs, maxNumber: this.config.maxNumber};
    const cipher = createCipheriv('aes-256-gcm', sealKey(secret), iv); cipher.setAAD(aad);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(ticket), 'utf8'), cipher.final()]);
    const salt = ['tc1', keyId(secret), iv.toString('base64url'), encrypted.toString('base64url'), cipher.getAuthTag().toString('base64url')].join('.');
    // The solved five-field request must fit the deployment's existing body
    // budget; do not impose unrelated username/password/code length limits.
    if (Buffer.byteLength(salt) + 512 > this.maxWireBytes) throw new FirstSliceError(413, 'original_work_too_large', 'Challenge request is too large.');
    const challenge = hash(salt + randomInt(0, this.config.maxNumber + 1));
    return {algorithm: 'SHA-256', challenge, maxNumber: this.config.maxNumber, salt, signature: this.signature(secret, salt, challenge)};
  }
  async consume(solution: unknown, loginToken = '', requireLogin?: (token: string) => Promise<void>): Promise<OriginalProofTarget> {
    if (!record(solution) || solution.algorithm !== 'SHA-256' || !bounded(solution.salt, this.maxWireBytes) ||
      !bounded(solution.challenge, 64) || !/^[0-9a-f]{64}$/.test(solution.challenge) ||
      !bounded(solution.signature, 64) || !/^[0-9a-f]{64}$/.test(solution.signature) ||
      !Number.isSafeInteger(solution.number) || Number(solution.number) < 0 || Number(solution.number) > this.config.maxNumber) throw invalid();
    const parts = solution.salt.split('.');
    if (parts.length !== 5 || parts[0] !== 'tc1' || !/^[0-9a-f]{32}$/.test(parts[1]!) ||
      parts.slice(2).some(value => !/^[A-Za-z0-9_-]+$/.test(value))) throw invalid();
    const secret = this.keys.get(parts[1]!);
    if (!secret || !equal(solution.signature, this.signature(secret, solution.salt, solution.challenge)) ||
      !equal(hash(solution.salt + solution.number), solution.challenge)) throw invalid();
    let ticket: unknown;
    try {
      const iv = Buffer.from(parts[2]!, 'base64url'), ciphertext = Buffer.from(parts[3]!, 'base64url'), tag = Buffer.from(parts[4]!, 'base64url');
      if (iv.length !== 12 || tag.length !== 16 || [iv, ciphertext, tag].some((part, index) => part.toString('base64url') !== parts[index + 2])) throw invalid();
      const decipher = createDecipheriv('aes-256-gcm', sealKey(secret), iv); decipher.setAAD(aad); decipher.setAuthTag(tag);
      ticket = JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'));
    } catch { throw invalid(); }
    if (!ticketValid(ticket, this.maxWireBytes) ||
      ticket.maxNumber !== this.config.maxNumber || Number(ticket.expiresAt) - Number(ticket.issuedAt) !== this.config.ttlMs ||
      Number(ticket.issuedAt) > this.now() + 5000) throw invalid();
    if (Number(ticket.expiresAt) <= this.now()) throw new FirstSliceError(400, 'original_work_expired', 'Challenge has expired.');
    if (ticket.kind === 'person') {
      if (!bounded(loginToken, 256) || !loginToken) throw new FirstSliceError(401, 'original_token_missing', 'Auth Header not sufficient: missing or empty');
      await requireLogin?.(loginToken);
      if (!equal(ticket.tokenHash, hash(loginToken))) throw invalid();
    }
    const accepted = await this.repository.consumeProofOfWorkChallenge({challengeId: 'original:' + ticket.challengeId,
      consumedAt: new Date(this.now()).toISOString(), expiresAt: new Date(Number(ticket.expiresAt)).toISOString()});
    if (!accepted) throw new FirstSliceError(409, 'original_work_replayed', 'Challenge has already been used.');
    return ticket.kind === 'login' ? {kind: 'login', name: ticket.name, password: ticket.password} : {kind: 'person', code: ticket.code, tokenHash: ticket.tokenHash};
  }
  private signature(secret: string, salt: string, challenge: string): string {
    return createHmac('sha256', secret).update('testcenter-original-session-work:v1\0')
      .update(JSON.stringify({algorithm: 'SHA-256', salt, challenge, maxNumber: this.config.maxNumber})).digest('hex');
  }
}
