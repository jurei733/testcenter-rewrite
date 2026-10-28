import type {OriginalTestResultState, OperationalLoginMigrationCandidate, TestRun, ParticipantSession} from '@testcenter-rewrite-app/domain';
import type {OriginalMonitorActor} from './original-monitor-session.js';
import {originalMonitorGroupSelection} from './original-monitor-session.js';
import {assertOriginalMonitorActor, type OriginalMonitorData, type OriginalMonitorPerson, type OriginalMonitorCollections} from './original-monitor-store.js';
import {selectOriginalPersonNumber} from './original-person-number.js';
import type {OriginalTestNumberRecord} from './original-test-number.js';
import {prepareOriginalTestLock} from './original-test-lock.js';
import {FirstSliceError} from './first-slice-error.js';
import {OriginalPhpObject, OriginalPhpNumber} from './original-test-log-json.js';

const internal = () => new FirstSliceError(500, 'original_monitor_lock_invalid', 'Internal error.');
/** PHP foreach iterates object values, ignores scalar fields, and invokes its
 * strict int parameter only as each selected item is reached. Never pre-validate
 * the whole selection: earlier successful writes must remain committed. */
export function originalMonitorLockSelection(body: unknown): unknown[] {
  const value = body instanceof OriginalPhpObject ? body.fields.get('testIds') :
    body && typeof body === 'object' && !Array.isArray(body) && Object.hasOwn(body, 'testIds') ? (body as Record<string, unknown>).testIds : undefined;
  if (Array.isArray(value)) return value;
  if (value instanceof OriginalPhpObject) return [...value.fields.values()];
  if (value && typeof value === 'object' && !(value instanceof OriginalPhpNumber)) return Object.values(value);
  return [];
}
export function originalMonitorLockTestNumber(value: unknown): string {
  if (value instanceof OriginalPhpNumber) {if (value.integer !== null) return value.integer.toString(); throw internal();}
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw internal();
  return String(value);
}
export type OriginalMonitorLockTarget = {scope: OriginalTestNumberRecord; person: OriginalMonitorPerson; resultState: OriginalTestResultState | undefined};
export type OriginalMonitorLockResult = {scope: OriginalTestNumberRecord; actorPersonNumber: string};
export function prepareOriginalMonitorSelectedLock(data: OriginalMonitorData, candidates: readonly OperationalLoginMigrationCandidate[],
  actor: OriginalMonitorActor, groupKey: string, testNumber: string, target: OriginalMonitorLockTarget | null, locked: boolean, timestamp: string) {
  assertOriginalMonitorActor(data, actor); originalMonitorGroupSelection(actor, groupKey);
  const actorPerson = data.people.find(person => person.participantSessionId === actor.participantSessionId)!;
  const actorPersonNumber = selectOriginalPersonNumber({...actorPerson, originalLoginKey: actor.originalLoginKey, originalNameSuffix: actorPerson.originalNameSuffix!},
    data.personNumbers.find(record => record.participantSessionId === actor.participantSessionId), actorPerson);
  if (!actorPersonNumber) throw new FirstSliceError(409, 'original_monitor_identity_unknown', 'The native monitor person identity is unavailable.');
  const missing = () => new FirstSliceError(404, 'original_monitor_test_missing', 'Test not found');
  if (!target || target.scope.testNumber !== testNumber || target.scope.tenantId !== actor.tenantId || target.scope.workspaceId !== actor.workspaceId ||
    target.person.participantSessionId !== target.scope.participantSessionId || target.person.tenantId !== actor.tenantId || target.person.workspaceId !== actor.workspaceId ||
    target.person.contentReleaseId !== target.scope.contentReleaseId || typeof target.person.originalLoginKey !== 'string' || typeof target.person.originalNameSuffix !== 'string') throw missing();
  const entries = data.entries.filter(entry => entry.tenantId === actor.tenantId && entry.workspaceId === actor.workspaceId &&
    entry.loginKey === target.person.originalLoginKey && entry.originalLoginIdentity === true);
  const operational = data.operationalLogins.some(login => login.loginKey === target.person.originalLoginKey) ?
    candidates.filter(candidate => candidate.loginKey === target.person.originalLoginKey) : [];
  if (entries.length + operational.length > 1) throw new FirstSliceError(409, 'original_monitor_target_ambiguous', 'The current native Login is ambiguous.');
  const currentGroup = entries[0]?.groupKey ?? operational[0]?.groupKey;
  if (currentGroup !== groupKey) throw new FirstSliceError(400, 'original_monitor_test_group_mismatch', `Test \`${testNumber}\` not found in group \`${groupKey}\``);
  const effect = {...prepareOriginalTestLock(timestamp, target.resultState), locked};
  return {effect, result: {scope: {...target.scope}, actorPersonNumber} satisfies OriginalMonitorLockResult};
}

type Collection<Row> = Map<string, Row> | Record<string, Row>;
const get = <Row>(collection: Collection<Row>, key: string): Row | undefined => collection instanceof Map ? collection.get(key) : Object.hasOwn(collection, key) ? collection[key] : undefined;
const values = <Row>(collection: Collection<Row>): Row[] => collection instanceof Map ? [...collection.values()] : Object.values(collection);
export type OriginalMonitorLockCollections = Omit<OriginalMonitorCollections,'testRuns'|'participantSessions'> & {
  testRuns: Collection<TestRun>; participantSessions: Collection<ParticipantSession>;
  originalTestRunsByNumber: Collection<string>;
  operationalLoginMigrationCandidates: Collection<OperationalLoginMigrationCandidate[]>;
};
export function changeOriginalMonitorLockCollection(state: OriginalMonitorLockCollections, actor: OriginalMonitorActor, groupKey: string,
  testNumber: string, locked: boolean, timestamp: string): OriginalMonitorLockResult {
  const key = actor.tenantId + '::' + actor.workspaceId;
  const data: OriginalMonitorData = {scope: actor,
    tenantActive: values(state.tenants).some(row => row.tenantId === actor.tenantId && row.status === 'active'),
    workspaceActive: values(state.workspacesByScope).some(row => row.tenantId === actor.tenantId && row.workspaceId === actor.workspaceId && row.status === 'active'),
    people: values(state.participantSessions), bindings: values(state.originalLoginBindings), operationalLogins: get(state.originalOperationalLogins,key) ?? [],
    entries: values(state.participantRosterEntries), personNumbers: values(state.originalPersonNumbers), runs: [], units: [], testNumbers: []};
  assertOriginalMonitorActor(data,actor); originalMonitorGroupSelection(actor,groupKey);
  const runId = get(state.originalTestRunsByNumber,testNumber), mapping = runId ? get(state.originalTestNumbers,runId) : undefined;
  const run = mapping && mapping.tenantId === actor.tenantId && mapping.workspaceId === actor.workspaceId ? get(state.testRuns,mapping.testRunId) : undefined;
  const person = run ? get(state.participantSessions,run.participantSessionId) : undefined;
  const target = run && mapping && person && (['testRunId','participantSessionId','tenantId','workspaceId','contentReleaseId'] as const).every(key => run[key] === mapping[key]) ?
    {scope:mapping,person,resultState:run.originalResultState} : null;
  const prepared = prepareOriginalMonitorSelectedLock(data,get(state.operationalLoginMigrationCandidates,key)??[],actor,groupKey,testNumber,target,locked,timestamp);
  const after = {...run!,...prepared.effect};
  if(state.testRuns instanceof Map)state.testRuns.set(runId!,after);else Object.defineProperty(state.testRuns,runId!,{value:after,writable:true,configurable:true,enumerable:true});
  return prepared.result;
}
