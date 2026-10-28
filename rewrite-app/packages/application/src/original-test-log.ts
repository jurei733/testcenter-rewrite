import {exactParticipantTestLogTimestamp} from '@testcenter-rewrite-app/domain';
import type {ParticipantSession, ParticipantTestLog, TestRun} from '@testcenter-rewrite-app/domain';
import {parseOriginalNativeTestNumber} from './original-test-access.js';
import {selectOwnedOriginalTestNumber, type OriginalTestNumberRecord} from './original-test-number.js';
import {resultParentUnavailable} from './result-artifact-parent.js';

const scopeKeys = ['testRunId', 'participantSessionId', 'tenantId', 'workspaceId', 'contentReleaseId'] as const;

export function assertOriginalTestLogInput(input: OriginalTestNumberRecord): void {
  if (scopeKeys.some(key => typeof input[key] !== 'string' || !input[key]) ||
      parseOriginalNativeTestNumber(input.testNumber) !== input.testNumber) {
    throw new TypeError('Native Test logs require their canonical immutable Test scope.');
  }
}

/** Validate the entire append before publishing any row. A duplicate request
 * receives new artifact IDs; duplicate artifact identities must never overwrite. */
export function prepareOriginalTestLogs(input: OriginalTestNumberRecord, logs: ParticipantTestLog[]): ParticipantTestLog[] {
  assertOriginalTestLogInput(input);
  if (!Array.isArray(logs)) throw new TypeError('Native Test logs require an array.');
  for (const log of logs) {
    if (!log || scopeKeys.filter(key => key !== 'contentReleaseId').some(key => log[key] !== input[key]) ||
        log.unitKey !== null || log.originalUnitId !== null ||
        typeof log.participantTestLogId !== 'string' || !log.participantTestLogId ||
        typeof log.logKey !== 'string' || typeof log.logContent !== 'string' ||
        !Number.isInteger(log.timestamp) || !Number.isFinite(log.timestamp) ||
        typeof log.recordedAt !== 'string' || !Number.isFinite(Date.parse(log.recordedAt)) ||
        (log.originalTimestamp !== undefined && (log.originalTimestamp !== 0 || log.timestamp !== 0))) {
      throw new TypeError('A native Test log cannot cross its immutable parent or Unit scope.');
    }
  }
  for (const log of logs) {
    if (!Number.isSafeInteger(log.timestamp) && log.originalClientTimestamp === undefined) throw new TypeError('The exact native timestamp is required.');
    exactParticipantTestLogTimestamp(log);
  }
  if (new Set(logs.map(log => log.participantTestLogId)).size !== logs.length) {
    throw new Error('Native Test log identity collision.');
  }
  return structuredClone(logs);
}

type Collection<Row> = Map<string, Row> | Record<string, Row>;
type State = {
  originalTestNumbers?: Collection<OriginalTestNumberRecord>;
  originalTestRunsByNumber: Collection<string>;
  testRuns: Collection<TestRun>;
  participantSessions: Collection<ParticipantSession>;
  participantTestLogs: Collection<ParticipantTestLog>;
};
const get = <Row>(collection: Collection<Row> | undefined, key: string): Row | undefined =>
  collection instanceof Map ? collection.get(key) : collection && Object.hasOwn(collection, key) ? collection[key] : undefined;

/** Recheck the native mapping and current parent before examining append data.
 * The Run, its saved state, revision, presence and clocks are never rewritten. */
export function appendOriginalTestLogCollection(state: State, input: OriginalTestNumberRecord, logs: ParticipantTestLog[]): void {
  assertOriginalTestLogInput(input);
  const mapping = selectOwnedOriginalTestNumber(input, get(state.originalTestNumbers, input.testRunId),
    get(state.testRuns, input.testRunId) ?? null, get(state.participantSessions, input.participantSessionId) ?? null);
  if (!mapping || scopeKeys.some(key => mapping[key] !== input[key]) ||
      get(state.originalTestRunsByNumber, input.testNumber) !== input.testRunId) throw resultParentUnavailable();
  const prepared = prepareOriginalTestLogs(input, logs);
  if (prepared.some(log => get(state.participantTestLogs, log.participantTestLogId))) throw new Error('Native Test log identity collision.');
  for (const log of prepared) {
    if (state.participantTestLogs instanceof Map) state.participantTestLogs.set(log.participantTestLogId, log);
    else Object.defineProperty(state.participantTestLogs, log.participantTestLogId, {value: log, writable: true, enumerable: true, configurable: true});
  }
}

/** TestDAO receives already PHP-JSON-encoded content. Its string "0" is falsy,
 * while the encoded empty string (two quote characters) remains present. */
export function formatOriginalTestLogEntry(log: Pick<ParticipantTestLog, 'logKey' | 'logContent'>): string {
  return log.logKey + (log.logContent && log.logContent !== '0' ? ' : ' + log.logContent : '');
}
