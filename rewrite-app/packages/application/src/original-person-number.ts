import type {ParticipantSession} from '@testcenter-rewrite-app/domain';

export type OriginalPersonNumberScope = Pick<ParticipantSession, 'participantSessionId' | 'tenantId' | 'workspaceId'> & {
  originalLoginKey: string; originalNameSuffix: string;
};
export type OriginalPersonNumberRecord = OriginalPersonNumberScope & {personNumber: string};
type PersonIdentity = Pick<ParticipantSession, 'participantSessionId' | 'tenantId' | 'workspaceId' | 'originalLoginKey' | 'originalNameSuffix'>;
const keys = ['participantSessionId', 'tenantId', 'workspaceId', 'originalLoginKey', 'originalNameSuffix'] as const;
const maximum = 9223372036854775807n;
function numberValue(value: string, zero = false): bigint {
  if (typeof value !== 'string' || !/^(?:0|[1-9][0-9]{0,18})$/.test(value) || BigInt(value) > maximum || !zero && value === '0') {
    throw new Error('Invalid persisted native person number.');
  }
  return BigInt(value);
}
function knownScope(person: PersonIdentity): boolean {
  return keys.every(key => typeof person[key] === 'string' && (key === 'originalNameSuffix' || person[key] !== ''));
}

/** Allocate only inside successful fresh native person creation. Reentry never
 * reserves a number, and pre-existing people without evidence stay unnumbered.
 * Decimal strings preserve all signed-int64 identities without JS rounding. */
export function prepareOriginalPersonNumber(person: ParticipantSession, counter: string): {record: OriginalPersonNumberRecord; counter: string} {
  if (!knownScope(person)) throw new TypeError('A native person number requires its observed immutable identity.');
  const current = numberValue(counter, true);
  if (current === maximum) throw new Error('Native person number space is exhausted.');
  const next = (current + 1n).toString();
  return {record: Object.fromEntries([...keys.map(key => [key, person[key]]), ['personNumber', next]]) as OriginalPersonNumberRecord, counter: next};
}

/** Metadata-only ownership check; never infers an identity or reads responses. */
export function selectOriginalPersonNumber(input: OriginalPersonNumberScope, record: OriginalPersonNumberRecord | undefined,
  person: PersonIdentity | null | undefined): string | null {
  if (!record || !person || !knownScope(input) || !knownScope(person) || keys.some(key => record[key] !== input[key] || person[key] !== input[key])) return null;
  numberValue(record.personNumber);
  return record.personNumber;
}

/** Additive file-store upgrade starts with an empty mapping, never a backfill. */
export function validateOriginalPersonNumbers(records: Record<string, OriginalPersonNumberRecord>, counter: string,
  people: Record<string, ParticipantSession>): void {
  const current = numberValue(counter, true), seen = new Set<string>();
  if (!records || typeof records !== 'object' || Array.isArray(records)) throw new Error('Invalid persisted native person numbers.');
  for (const [id, record] of Object.entries(records)) {
    if (!record || record.participantSessionId !== id || selectOriginalPersonNumber(record, record, people[id]) === null ||
      seen.has(record.personNumber) || numberValue(record.personNumber) > current) throw new Error('Invalid persisted native person number scope.');
    seen.add(record.personNumber);
  }
}

export type OriginalPersonCredentialInput = OriginalPersonNumberScope & {tokenHash: string; updatedAt: string};
/** A trusted monitor may initialize a native bearer, but may never rotate an
 * already active one or restore a concurrently deleted/out-of-scope person. */
export function originalPersonCredentialMatches(input: OriginalPersonCredentialInput, person: PersonIdentity | null | undefined): boolean {
  if (!knownScope(input) || typeof input.tokenHash !== 'string' || !/^[a-f0-9]{64}$/.test(input.tokenHash) ||
    typeof input.updatedAt !== 'string' || !Number.isFinite(Date.parse(input.updatedAt))) throw new TypeError('Invalid native person credential initialization.');
  return !!person && knownScope(person) && keys.every(key=>person[key]===input[key]);
}
