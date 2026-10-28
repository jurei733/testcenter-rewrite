import {participantExecutionModeDefinitions, type OriginalNativeUnit, type ParticipantRosterEntry, type ParticipantSession, type TestRun} from '@testcenter-rewrite-app/domain';
import {FirstSliceError} from './first-slice-error.js';
import {originalParticipantGroupKeysEqual} from './original-participant-group.js';
import {assertOriginalTestState, originalPhpMap} from './original-test-state.js';
import {encodeOriginalReportJson} from './original-workspace-report-wire.js';

export type OriginalMonitorActor = Pick<ParticipantSession, 'participantSessionId' | 'tenantId' | 'workspaceId' | 'groupKey'> & {
  originalLoginKey: string; mode: 'monitor-group' | 'monitor-study';
};
/** Deliberately excludes responses, attachments, logs and controller payloads. */
export type OriginalMonitorTest = Pick<TestRun, 'testRunId' | 'participantSessionId' | 'tenantId' | 'workspaceId' | 'contentReleaseId' |
  'originalResultState' | 'originalTestState' | 'locked'>;
export type OriginalMonitorUnit = Pick<OriginalNativeUnit, 'testRunId' | 'participantSessionId' | 'tenantId' | 'workspaceId' |
  'contentReleaseId' | 'unitName' | 'state' | 'unknownHistory'>;
export type OriginalMonitorPacket = {
  personId: string; timestamp: number; testId: string; groupName: string; groupLabel: string;
  personLabel: string; mode: string; testState: Record<string, unknown>; bookletName: string;
  unitName?: string; unitState: Record<string, unknown>;
};
const unavailable = () => new FirstSliceError(409, 'original_monitor_history_unknown', 'The historical Original monitor state is unavailable.');
const scopeKeys = ['testRunId', 'participantSessionId', 'tenantId', 'workspaceId', 'contentReleaseId'] as const;
const maximum = 9223372036854775807n;
function nativeNumber(value: string): string {
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,18}$/.test(value) || BigInt(value) > maximum) throw unavailable();
  return value;
}
export function originalMonitorable(entry: Pick<ParticipantRosterEntry, 'executionMode' | 'originalLoginIdentity'>): boolean {
  return entry.originalLoginIdentity === true && entry.executionMode !== undefined && participantExecutionModeDefinitions[entry.executionMode]?.monitorable === true;
}
/** Source's empty group-monitor selection becomes [0]. Preserve that observed
 * selection only within the authenticated group; never expose another group 0. */
export function originalMonitorGroupSelection(actor: OriginalMonitorActor, requested?: string): string | undefined | null {
  if (actor.mode !== 'monitor-group' && actor.mode !== 'monitor-study') throw new FirstSliceError(403, 'original_monitor_forbidden', 'A native monitor is required.');
  if (actor.mode === 'monitor-study') return requested;
  const selected = requested ?? '0';
  if (originalParticipantGroupKeysEqual(selected, actor.groupKey)) return actor.groupKey;
  if (requested === undefined) return null;
  throw new FirstSliceError(403, 'original_monitor_group_forbidden', 'The requested group is not available to this monitor.');
}
function phpTruthy(value: unknown): boolean {
  return !(value === undefined || value === null || value === false || value === 0 || value === '' || value === '0' || Array.isArray(value) && value.length === 0);
}
export function originalMonitorCurrentUnit(run: OriginalMonitorTest): string | null {
  if (run.originalTestState === undefined) {
    if (run.originalResultState?.hasTestState === false) return null;
    throw unavailable();
  }
  assertOriginalTestState(run.originalTestState);
  const value = run.originalTestState.CURRENT_UNIT_ID;
  if (!phpTruthy(value)) return null;
  // Source's strict getUnitState(string) also refuses a truthy non-string.
  if (typeof value !== 'string') throw new TypeError('The saved native current Unit is not a string.');
  return value;
}

/** Current Login metadata and saved native Test/Unit evidence have independent
 * owners. No canonical Run status, currentUnitKey or response is a substitute. */
export function projectOriginalMonitorSession(input: {
  person: Pick<ParticipantSession, 'participantSessionId' | 'tenantId' | 'workspaceId' | 'contentReleaseId' | 'originalLoginKey' | 'originalNameSuffix'>;
  entry: Pick<ParticipantRosterEntry, 'tenantId' | 'workspaceId' | 'loginKey' | 'groupKey' | 'groupLabel' | 'executionMode' | 'originalLoginIdentity'>;
  run: OriginalMonitorTest; personNumber: string | null; testNumber: string | null; unit: OriginalMonitorUnit | null;
}): OriginalMonitorPacket {
  const {person, entry, run, unit} = input;
  if (!originalMonitorable(entry) || typeof person.originalNameSuffix !== 'string' || person.originalLoginKey !== entry.loginKey ||
    ['participantSessionId', 'tenantId', 'workspaceId', 'contentReleaseId'].some(key => person[key as keyof typeof person] !== run[key as keyof OriginalMonitorTest]) ||
    entry.tenantId !== person.tenantId || entry.workspaceId !== person.workspaceId || input.personNumber === null || input.testNumber === null) throw unavailable();
  const evidence = run.originalResultState;
  if (typeof evidence?.bookletName !== 'string' || evidence.lastOpenedAt === undefined ||
    typeof evidence.lastTestModifiedAt !== 'string' || !Number.isFinite(Date.parse(evidence.lastTestModifiedAt))) throw unavailable();
  if (evidence.lastOpenedAt !== null && (typeof evidence.lastOpenedAt !== 'string' || !Number.isFinite(Date.parse(evidence.lastOpenedAt)))) throw unavailable();
  const currentUnit = originalMonitorCurrentUnit(run);
  const state = run.originalTestState === undefined ? {} : structuredClone(run.originalTestState);
  state.status = run.locked === true ? 'locked' : evidence.lastOpenedAt === null ? 'pending' : 'running';
  let unitState: Record<string, unknown> = {};
  if (unit) {
    if (currentUnit === null || scopeKeys.some(key => unit[key] !== run[key]) || !originalParticipantGroupKeysEqual(unit.unitName, currentUnit) || unit.unknownHistory) throw unavailable();
    assertOriginalTestState(unit.state); unitState = structuredClone(unit.state);
  }
  const suffix = person.originalNameSuffix;
  return {personId: nativeNumber(input.personNumber), timestamp: Math.floor(Date.parse(evidence.lastTestModifiedAt) / 1000),
    testId: nativeNumber(input.testNumber), groupName: entry.groupKey, groupLabel: entry.groupLabel ?? '',
    personLabel: entry.loginKey + (phpTruthy(suffix) ? '/' + suffix : ''), mode: entry.executionMode!,
    testState: state, bookletName: evidence.bookletName, ...(currentUnit === null ? {} : {unitName: currentUnit}), unitState};
}

/** JSON number literals remain exact beyond JS safe integers. Source omits
 * empty strings and forces empty Test/Unit state maps to {} rather than []. */
export function formatOriginalMonitorSessionsJson(rows: OriginalMonitorPacket[]): string {
  return '[' + rows.map(row => {
    const entries: Array<[string, string]> = [
      ['personId', nativeNumber(row.personId)], ['timestamp', String(row.timestamp)], ['testId', nativeNumber(row.testId)],
      ['groupName', encodeOriginalReportJson(row.groupName)]
    ];
    if (!Number.isSafeInteger(row.timestamp)) throw unavailable();
    if (row.groupLabel !== '') entries.push(['groupLabel', encodeOriginalReportJson(row.groupLabel)]);
    if (row.personLabel !== '') entries.push(['personLabel', encodeOriginalReportJson(row.personLabel)]);
    if (row.mode !== '') entries.push(['mode', encodeOriginalReportJson(row.mode)]);
    entries.push(['testState', Object.keys(row.testState).length ? originalPhpMap(Object.entries(row.testState)) : '{}']);
    if (row.bookletName !== '') entries.push(['bookletName', encodeOriginalReportJson(row.bookletName)]);
    if (row.unitName !== undefined && row.unitName !== '') entries.push(['unitName', encodeOriginalReportJson(row.unitName)]);
    entries.push(['unitState', Object.keys(row.unitState).length ? originalPhpMap(Object.entries(row.unitState)) : '{}']);
    return '{' + entries.map(([key, value]) => encodeOriginalReportJson(key) + ':' + value).join(',') + '}';
  }).join(',') + ']';
}
