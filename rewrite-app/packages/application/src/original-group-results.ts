import type {OriginalGroupResult} from '@testcenter-rewrite-app/contracts/original-group-results';
import type {FirstSliceRepository} from './index.js';
import type {OriginalLoginBinding, OriginalParticipantGroup, ParticipantSession, TestRun, WorkspaceActivityEvent, WorkspaceReview} from '@testcenter-rewrite-app/domain';
import {FirstSliceError} from './first-slice-error.js';
import {originalParticipantGroupKeysEqual} from './original-participant-group.js';
import {originalReviewUnitEventTypes, selectOriginalSavedUnitKeys} from './original-saved-unit-projection.js';

const unavailable = () => new FirstSliceError(409, 'original_result_history_unavailable', 'The Original result history is unavailable or ambiguous.');
const serverTime = (value: unknown): number => {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw unavailable();
  return Date.parse(value);
};
export type OriginalResultTest = Pick<TestRun, 'testRunId' | 'participantSessionId' | 'tenantId' | 'workspaceId' | 'contentReleaseId'> & {
  savedUnitKeys: string[]; bookletName?: string; lastOpenedAt?: string | null; lastTestModifiedAt?: string | null;
};
export function projectOriginalResultTest(run: Pick<TestRun, 'testRunId' | 'participantSessionId' | 'tenantId' | 'workspaceId' | 'contentReleaseId' | 'originalResultState'> & {unitResponses?: TestRun['unitResponses']},
  savedUnitKeys: readonly string[] = Object.keys(run.unitResponses ?? {})): OriginalResultTest {
  if (!Array.isArray(savedUnitKeys) || savedUnitKeys.some(key => typeof key !== 'string')) throw unavailable();
  const state = run.originalResultState;
  return {testRunId: run.testRunId, participantSessionId: run.participantSessionId, tenantId: run.tenantId, workspaceId: run.workspaceId,
    contentReleaseId: run.contentReleaseId, savedUnitKeys: [...savedUnitKeys],
    ...(state?.bookletName === undefined ? {} : {bookletName: state.bookletName}),
    ...(state?.lastOpenedAt === undefined ? {} : {lastOpenedAt: state.lastOpenedAt}),
    ...(state?.lastTestModifiedAt === undefined ? {} : {lastTestModifiedAt: state.lastTestModifiedAt})};
}
export type OriginalGroupResultInventory = {
  people: Array<Pick<ParticipantSession, 'participantSessionId' | 'tenantId' | 'workspaceId' | 'contentReleaseId' | 'originalLoginKey' | 'groupKey'>>;
  bindings: Array<Pick<OriginalLoginBinding, 'tenantId' | 'workspaceId' | 'loginKey' | 'groupKey' | 'groupSnapshotKey'>>;
  groups: Array<Pick<OriginalParticipantGroup, 'tenantId' | 'workspaceId' | 'groupKey' | 'groupLabel' | 'lastModifiedAt'>>;
  runs: OriginalResultTest[];
  reviews: Array<Pick<WorkspaceReview, 'tenantId' | 'workspaceId' | 'participantSessionId' | 'testRunId' | 'unitKey'>>;
  events: Array<Pick<WorkspaceActivityEvent, 'tenantId' | 'workspaceId' | 'eventType' | 'subjectType' | 'subjectId' | 'occurredAt' | 'details'>>;
};
/** Copy only result identities and clocks synchronously from one owned state. */
export function projectOriginalGroupResultInventory(input: OriginalGroupResultInventory): OriginalGroupResultInventory {
  return {
    people: input.people.map(row => ({tenantId: row.tenantId, workspaceId: row.workspaceId, participantSessionId: row.participantSessionId,
      contentReleaseId: row.contentReleaseId, groupKey: row.groupKey, ...(typeof row.originalLoginKey === 'string' ? {originalLoginKey: row.originalLoginKey} : {})})),
    bindings: input.bindings.map(row => ({tenantId: row.tenantId, workspaceId: row.workspaceId, loginKey: row.loginKey, groupKey: row.groupKey, groupSnapshotKey: row.groupSnapshotKey})),
    groups: input.groups.map(row => ({tenantId: row.tenantId, workspaceId: row.workspaceId, groupKey: row.groupKey, groupLabel: row.groupLabel, lastModifiedAt: row.lastModifiedAt})),
    runs: input.runs.map(row => ({...row, savedUnitKeys: [...row.savedUnitKeys]})),
    reviews: input.reviews.map(row => ({tenantId: row.tenantId, workspaceId: row.workspaceId, participantSessionId: row.participantSessionId, testRunId: row.testRunId, unitKey: row.unitKey})),
    events: input.events.filter(event => originalReviewUnitEventTypes.includes(event.eventType as typeof originalReviewUnitEventTypes[number]))
      .map(row => ({tenantId: row.tenantId, workspaceId: row.workspaceId, eventType: row.eventType, subjectType: row.subjectType, subjectId: row.subjectId, occurredAt: row.occurredAt,
        details: Object.fromEntries(['reviewId', 'participantSessionId', 'unitKey'].filter(key => typeof row.details?.[key] === 'string').map(key => [key, row.details[key]]))}))
  };
}
type Scope = {tenantId: string; workspaceId: string};
const inScope = (row: Scope, scope: Scope): boolean => row.tenantId === scope.tenantId && row.workspaceId === scope.workspaceId;

/** Reproduce Source grouping from credential-stage snapshots, mutable Login
 * bindings, actual opening history and distinct persisted Units. Current roster
 * labels, Run.updatedAt and arbitrary Unit logs do not establish that history. */
export function projectOriginalGroupResults(input: Scope & OriginalGroupResultInventory & {selectedGroups?: string[]}): OriginalGroupResult[] {
  const people = new Map(input.people.filter(person => inScope(person, input) && typeof person.originalLoginKey === 'string')
    .map(person => [person.participantSessionId, person]));
  const bindingsByLogin = new Map<string, OriginalGroupResultInventory['bindings']>();
  for (const binding of input.bindings) {
    if (!inScope(binding, input)) continue;
    const values = bindingsByLogin.get(binding.loginKey) ?? []; values.push(binding); bindingsByLogin.set(binding.loginKey, values);
  }
  const groupsBySnapshot = new Map<string, OriginalGroupResultInventory['groups']>();
  for (const group of input.groups) {
    if (!inScope(group, input)) continue;
    const values = groupsBySnapshot.get(group.groupKey) ?? []; values.push(group); groupsBySnapshot.set(group.groupKey, values);
  }
  const runs = input.runs.filter(run => inScope(run, input) && people.has(run.participantSessionId));
  const savedUnits = selectOriginalSavedUnitKeys({testRuns: runs, persistedUnitKeys: new Map(runs.map(run => [run.testRunId, run.savedUnitKeys])), reviews: input.reviews, activityEvents: input.events});
  const rows = new Map<string, {group: OriginalGroupResultInventory['groups'][number]; name: string; started: number; minimum: number; maximum: number; total: number; modified: number}>();
  const identities = new Set<string>();
  for (const run of runs) {
    if (run.lastOpenedAt === null) continue;
    const person = people.get(run.participantSessionId)!;
    const bindings = bindingsByLogin.get(person.originalLoginKey!) ?? [];
    if (bindings.length !== 1) throw unavailable();
    const binding = bindings[0]!;
    if (!originalParticipantGroupKeysEqual(binding.groupKey, person.groupKey)) throw unavailable();
    if (input.selectedGroups?.length && !input.selectedGroups.some(group => originalParticipantGroupKeysEqual(group, binding.groupKey))) continue;
    const groups = groupsBySnapshot.get(binding.groupSnapshotKey) ?? [];
    if (groups.length !== 1 || !originalParticipantGroupKeysEqual(binding.groupKey, binding.groupSnapshotKey)) throw unavailable();
    const group = groups[0]!;
    serverTime(run.lastOpenedAt);
    if (typeof group.groupLabel !== 'string') throw unavailable();
    if (run.contentReleaseId !== person.contentReleaseId || typeof run.bookletName !== 'string' || !run.bookletName.length) throw unavailable();
    const identity = JSON.stringify([person.participantSessionId, run.bookletName]);
    if (identities.has(identity)) throw unavailable();
    identities.add(identity);
    const modified = Math.max(serverTime(group.lastModifiedAt), serverTime(run.lastTestModifiedAt));
    const count = savedUnits.get(run.testRunId)?.size ?? 0;
    const row = rows.get(group.groupKey) ?? {group, name: binding.groupKey, started: 0, minimum: count, maximum: count, total: 0, modified};
    row.started++; row.total += count; row.minimum = Math.min(row.minimum, count); row.maximum = Math.max(row.maximum, count);
    row.modified = Math.max(row.modified, modified);
    rows.set(group.groupKey, row);
  }
  return [...rows.values()].map(row => ({groupName: row.name, groupLabel: row.group.groupLabel, bookletsStarted: row.started,
    numUnitsMin: row.minimum, numUnitsMax: row.maximum, numUnitsTotal: row.total,
    numUnitsAvg: row.total / row.started, lastChange: Math.floor(row.modified / 1000)}))
    .sort((left, right) => left.groupName.localeCompare(right.groupName));
}

export type OriginalGroupResultsPort = {
  list(input: {tenantKey: string; workspaceKey: string; groups?: string[]}): Promise<OriginalGroupResult[]>;
};
export function createOriginalGroupResultsPort(repository: FirstSliceRepository,
  workspace: (tenantKey: string, workspaceKey: string) => Promise<Scope>): OriginalGroupResultsPort {
  return {async list(input) {
    const {tenantKey, workspaceKey} = input;
    if (input.groups !== undefined && (!Array.isArray(input.groups) || input.groups.some(group => typeof group !== 'string'))) throw new FirstSliceError(400, 'original_result_groups_invalid', 'Group names must be strings.');
    const selectedGroups = input.groups?.slice();
    const scope = await workspace(tenantKey, workspaceKey);
    const inventory = await repository.getOriginalGroupResultInventory(scope.tenantId, scope.workspaceId);
    return projectOriginalGroupResults({...scope, ...inventory, selectedGroups});
  }};
}
