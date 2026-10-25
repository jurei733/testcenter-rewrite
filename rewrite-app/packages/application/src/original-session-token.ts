import {createHash, randomInt} from 'node:crypto';
import type {ParticipantSession} from '@testcenter-rewrite-app/domain';

/** Private recoverable Login/group capabilities, as in Source. Never roster/export data. */
export type OriginalSessionToken = {
  tenantId: string;
  workspaceId: string;
  kind: 'login' | 'group';
  subjectKey: string;
  token: string;
  createdAt: string;
};
export type OriginalSessionTokenRepository = {
  getOrCreateOriginalSessionToken(candidate: OriginalSessionToken): Promise<OriginalSessionToken | null>;
  findOriginalSessionTokenByHash(tokenHash: string): Promise<OriginalSessionToken | null>;
  findParticipantSessionByAccessTokenHash(tokenHash: string): Promise<ParticipantSession | null>;
};
export class OriginalSessionTokenCollisionError extends Error {}
const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789_-';
export const createOriginalSessionToken = (): string =>
  Array.from({length: 24}, () => alphabet[randomInt(alphabet.length)]).join('');
export const hashOriginalSessionToken = (token: string): string => createHash('sha256').update(token).digest('hex');
export const originalSessionTokenKey = (token: Pick<OriginalSessionToken, 'tenantId' | 'workspaceId' | 'kind' | 'subjectKey'>): string =>
  JSON.stringify([token.tenantId, token.workspaceId, token.kind, token.subjectKey]);
export function prepareOriginalSessionToken(candidate: OriginalSessionToken): OriginalSessionToken {
  if (!['login', 'group'].includes(candidate.kind) ||
    ![candidate.tenantId, candidate.workspaceId, candidate.subjectKey].every(value => typeof value === 'string' && value.length > 0) ||
    typeof candidate.token !== 'string' || !/^[a-z0-9_-]{24}$/.test(candidate.token) ||
    typeof candidate.createdAt !== 'string' || !Number.isFinite(Date.parse(candidate.createdAt))) {
    throw new TypeError('Invalid private Original session capability.');
  }
  return {...candidate};
}
export function selectOriginalSessionToken(candidate: OriginalSessionToken, stored: OriginalSessionToken[]): OriginalSessionToken {
  const key = originalSessionTokenKey(candidate);
  const existing = stored.find(token => originalSessionTokenKey(token) === key);
  if (existing) return {...existing};
  if (stored.some(token => token.token === candidate.token)) throw new OriginalSessionTokenCollisionError('Original session token collision.');
  return {...candidate};
}
