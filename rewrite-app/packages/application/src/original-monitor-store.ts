import type {OriginalLoginBinding, ParticipantRosterEntry, ParticipantSession} from '@testcenter-rewrite-app/domain';
import type {OriginalOperationalLogin} from './original-operational-login.js';
import type {OriginalPersonNumberRecord} from './original-person-number.js';
import {selectOriginalPersonNumber} from './original-person-number.js';
import type {OriginalTestNumberRecord} from './original-test-number.js';
import {FirstSliceError} from './first-slice-error.js';
import {originalParticipantGroupKeysEqual} from './original-participant-group.js';
import {originalMonitorCurrentUnit, originalMonitorGroupSelection, originalMonitorable, projectOriginalMonitorSession,
  type OriginalMonitorActor, type OriginalMonitorPacket, type OriginalMonitorTest, type OriginalMonitorUnit} from './original-monitor-session.js';

export type OriginalMonitorPerson = Pick<ParticipantSession, 'participantSessionId' | 'tenantId' | 'workspaceId' | 'contentReleaseId' |
  'originalLoginKey' | 'originalNameSuffix' | 'groupKey' | 'originalOperationalMode'>;
export type OriginalMonitorLogin = Pick<ParticipantRosterEntry, 'tenantId' | 'workspaceId' | 'loginKey' | 'groupKey' | 'groupLabel' | 'executionMode' | 'originalLoginIdentity'>;
export type OriginalMonitorData = {
  scope: {tenantId: string; workspaceId: string}; tenantActive: boolean; workspaceActive: boolean;
  people: readonly OriginalMonitorPerson[]; bindings: readonly OriginalLoginBinding[]; operationalLogins: readonly OriginalOperationalLogin[];
  entries: readonly OriginalMonitorLogin[]; runs: readonly OriginalMonitorTest[]; units: readonly OriginalMonitorUnit[];
  personNumbers: readonly OriginalPersonNumberRecord[]; testNumbers: readonly OriginalTestNumberRecord[];
};
export type OriginalMonitorRepository = {readOriginalMonitorSessions(actor: OriginalMonitorActor, groupKey?: string): Promise<OriginalMonitorPacket[]>};
const unknown = () => new FirstSliceError(409, 'original_monitor_history_unknown', 'The historical Original monitor state is unavailable.');
export function assertOriginalMonitorActor(data: OriginalMonitorData, actor: OriginalMonitorActor): void {
  const person = data.people.find(row => row.participantSessionId === actor.participantSessionId);
  const binding = data.bindings.find(row => row.tenantId === actor.tenantId && row.workspaceId === actor.workspaceId && row.loginKey === actor.originalLoginKey);
  if (!['monitor-group', 'monitor-study'].includes(actor.mode) || data.scope.tenantId !== actor.tenantId || data.scope.workspaceId !== actor.workspaceId ||
    !data.tenantActive || !data.workspaceActive || !person || person.tenantId !== actor.tenantId || person.workspaceId !== actor.workspaceId ||
    person.originalLoginKey !== actor.originalLoginKey || typeof person.originalNameSuffix !== 'string' || person.originalOperationalMode !== actor.mode ||
    !binding || !originalParticipantGroupKeysEqual(person.groupKey, actor.groupKey) || !originalParticipantGroupKeysEqual(binding.groupKey, actor.groupKey) ||
    !data.operationalLogins.some(row => row.loginKey === actor.originalLoginKey && row.loginMode === actor.mode)) {
    throw new FirstSliceError(403, 'original_monitor_forbidden', 'A current native monitor is required.');
  }
}
/** One immutable read snapshot. Membership comes from the current imported
 * Login, independently of first person suffixes and saved Test/Unit state. */
export function selectOriginalMonitorSessions(data: OriginalMonitorData, actor: OriginalMonitorActor, requested?: string): OriginalMonitorPacket[] {
  assertOriginalMonitorActor(data, actor);
  const group = originalMonitorGroupSelection(actor, requested);
  if (group === null) return [];
  const scoped = (row: {tenantId: string; workspaceId: string}) => row.tenantId === actor.tenantId && row.workspaceId === actor.workspaceId;
  const people = new Map(data.people.filter(scoped).map(row => [row.participantSessionId, row]));
  const numbers = new Map(data.personNumbers.filter(scoped).map(row => [row.participantSessionId, row]));
  const testNumbers = new Map(data.testNumbers.filter(scoped).map(row => [row.testRunId, row]));
  const packets: OriginalMonitorPacket[] = [];
  for (const run of data.runs) {
    if (!scoped(run)) continue;
    const person = people.get(run.participantSessionId);
    if (!person || person.originalLoginKey === undefined) continue;
    const entries = data.entries.filter(row => scoped(row) && row.loginKey === person.originalLoginKey && originalMonitorable(row));
    if (entries.length > 1) throw unknown();
    const entry = entries[0];
    if (!entry || group !== undefined && !originalParticipantGroupKeysEqual(entry.groupKey, group)) continue;
    if (typeof person.originalNameSuffix !== 'string') throw unknown();
    const personNumber = selectOriginalPersonNumber({...person, originalLoginKey: person.originalLoginKey, originalNameSuffix: person.originalNameSuffix}, numbers.get(person.participantSessionId), person);
    const mapping = testNumbers.get(run.testRunId);
    if (!mapping || (['testRunId', 'participantSessionId', 'tenantId', 'workspaceId', 'contentReleaseId'] as const).some(key => mapping[key] !== run[key])) throw unknown();
    const currentUnit = originalMonitorCurrentUnit(run);
    const units = currentUnit === null ? [] : data.units.filter(unit => unit.testRunId === run.testRunId && originalParticipantGroupKeysEqual(unit.unitName, currentUnit));
    if (units.length > 1) throw unknown();
    packets.push(projectOriginalMonitorSession({person, entry, run, personNumber, testNumber: mapping.testNumber, unit: units[0] ?? null}));
  }
  // Source has no ORDER BY and may reorder after person updates. A stable
  // numeric order changes no packet identity and is independent of private UUIDs.
  return packets.sort((a, b) => BigInt(a.personId) < BigInt(b.personId) ? -1 : BigInt(a.personId) > BigInt(b.personId) ? 1 : BigInt(a.testId) < BigInt(b.testId) ? -1 : BigInt(a.testId) > BigInt(b.testId) ? 1 : 0);
}

type Collection<Row> = Map<string, Row> | Record<string, Row>;
const values = <Row>(collection: Collection<Row>): Row[] => collection instanceof Map ? [...collection.values()] : Object.values(collection);
export type OriginalMonitorCollections = {
  tenants: Collection<{tenantId: string; status: string}>; workspacesByScope: Collection<{tenantId: string; workspaceId: string; status: string}>;
  participantSessions: Collection<OriginalMonitorPerson>; participantRosterEntries: Collection<OriginalMonitorLogin>;
  originalLoginBindings: Collection<OriginalLoginBinding>; originalOperationalLogins: Collection<OriginalOperationalLogin[]>;
  testRuns: Collection<OriginalMonitorTest>; originalNativeUnits: Collection<OriginalMonitorUnit>;
  originalPersonNumbers: Collection<OriginalPersonNumberRecord>; originalTestNumbers: Collection<OriginalTestNumberRecord>;
};
export function readOriginalMonitorCollections(state: OriginalMonitorCollections, actor: OriginalMonitorActor, requested?: string): OriginalMonitorPacket[] {
  const key = actor.tenantId + '::' + actor.workspaceId;
  const operationalLogins = state.originalOperationalLogins instanceof Map ? state.originalOperationalLogins.get(key) : state.originalOperationalLogins[key];
  return selectOriginalMonitorSessions({scope: actor, tenantActive: values(state.tenants).some(row => row.tenantId === actor.tenantId && row.status === 'active'),
    workspaceActive: values(state.workspacesByScope).some(row => row.tenantId === actor.tenantId && row.workspaceId === actor.workspaceId && row.status === 'active'),
    people: values(state.participantSessions), bindings: values(state.originalLoginBindings), operationalLogins: operationalLogins ?? [],
    entries: values(state.participantRosterEntries), runs: values(state.testRuns), units: values(state.originalNativeUnits),
    personNumbers: values(state.originalPersonNumbers), testNumbers: values(state.originalTestNumbers)}, actor, requested);
}
