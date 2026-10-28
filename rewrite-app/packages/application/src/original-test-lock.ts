import type {OriginalTestResultState, ParticipantSession, TestRun} from '@testcenter-rewrite-app/domain';
import {assertOriginalTestLogInput} from './original-test-log.js';
import {selectOwnedOriginalTestNumber, type OriginalTestNumberRecord} from './original-test-number.js';
import {resultParentUnavailable} from './result-artifact-parent.js';
import {FirstSliceError} from './first-slice-error.js';

/** The Source updates only its lock and server timestamp, even on repeated locks.
 * Keep this write separate from construction/insertion of the subsequent log:
 * actual production Source57 leaves the lock committed when that step fails. */
export function prepareOriginalTestLock(timestamp: string, before: OriginalTestResultState | undefined): {
  locked: true; updatedAt: string; originalResultState: OriginalTestResultState;
} {
  if (typeof timestamp !== 'string' || !Number.isFinite(Date.parse(timestamp))) throw new TypeError('Native Test lock requires a server timestamp.');
  if (!before || typeof before !== 'object' || Array.isArray(before) ||
      typeof before.bookletName !== 'string' || !before.bookletName.trim() || typeof before.bookletLabel !== 'string' ||
      before.hasTestState !== undefined && typeof before.hasTestState !== 'boolean') {
    throw new FirstSliceError(409, 'original_test_history_unknown', 'The Original Test identity is unavailable.');
  }
  for (const key of ['lastOpenedAt','lastTestStateAt','lastTestModifiedAt'] as const) {
    const value = before[key];
    if (value !== undefined && value !== null && (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))) {
      throw new Error('Invalid persisted Original Test timestamp.');
    }
  }
  const updatedAt = new Date(timestamp).toISOString();
  return {locked: true, updatedAt, originalResultState: {...structuredClone(before), lastTestModifiedAt: updatedAt}};
}

type Collection<Row> = Map<string, Row> | Record<string, Row>;
type State = {
  originalTestNumbers?: Collection<OriginalTestNumberRecord>;
  originalTestRunsByNumber: Collection<string>;
  testRuns: Collection<TestRun>;
  participantSessions: Collection<ParticipantSession>;
};
const get = <Row>(collection: Collection<Row> | undefined, key: string): Row | undefined =>
  collection instanceof Map ? collection.get(key) : collection && Object.hasOwn(collection, key) ? collection[key] : undefined;

export function lockOriginalTestCollection(state: State, input: OriginalTestNumberRecord, timestamp: string): void {
  assertOriginalTestLogInput(input);
  const run = get(state.testRuns, input.testRunId);
  const mapping = selectOwnedOriginalTestNumber(input, get(state.originalTestNumbers, input.testRunId), run ?? null,
    get(state.participantSessions, input.participantSessionId) ?? null);
  if (!mapping || !run || ['testRunId','participantSessionId','tenantId','workspaceId','contentReleaseId'].some(key =>
      mapping[key as keyof OriginalTestNumberRecord] !== input[key as keyof OriginalTestNumberRecord]) ||
      get(state.originalTestRunsByNumber, input.testNumber) !== input.testRunId) throw resultParentUnavailable();
  const locked = {...run, ...prepareOriginalTestLock(timestamp, run.originalResultState)};
  if (state.testRuns instanceof Map) state.testRuns.set(input.testRunId, locked);
  else Object.defineProperty(state.testRuns, input.testRunId, {value: locked, writable: true, enumerable: true, configurable: true});
}
