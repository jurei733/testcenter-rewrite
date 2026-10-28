import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import test from 'node:test';
import {formatOriginalMonitorSessionsJson, originalMonitorGroupSelection, originalMonitorCurrentUnit, projectOriginalMonitorSession,
  type OriginalMonitorActor, type OriginalMonitorPacket, type OriginalMonitorTest} from './original-monitor-session.js';

const root = resolve('test-fixtures/original-testcenter/source-workspace-results/native-monitor-sessions');
const receipt = JSON.parse(await readFile(resolve(root, 'receipt.json'), 'utf8'));
const unopenedBytes = await readFile(resolve(root, 'monitor-unopened.json'), 'utf8');
const unopened: Array<Omit<OriginalMonitorPacket, 'personId' | 'testId'> & {personId: number; testId: number}> = JSON.parse(unopenedBytes);
function native(packet: typeof unopened[number]) {
  const scope = {testRunId: 'private-run-' + packet.testId, participantSessionId: 'private-person-' + packet.personId,
    tenantId: 'owned-tenant', workspaceId: 'owned-workspace', contentReleaseId: 'private-release'};
  const slash = packet.personLabel.indexOf('/'), loginKey = slash < 0 ? packet.personLabel : packet.personLabel.slice(0, slash);
  const originalNameSuffix = slash < 0 ? '' : packet.personLabel.slice(slash + 1);
  const run: OriginalMonitorTest = {...scope, locked: packet.testState.status === 'locked',
    originalTestState: {...packet.testState, status: 'authored-status'}, originalResultState: {bookletName: packet.bookletName,
      bookletLabel: 'Private stored Booklet label', lastOpenedAt: packet.testState.status === 'pending' ? null : new Date(packet.timestamp * 1000).toISOString(),
      hasTestState: true, lastTestModifiedAt: new Date(packet.timestamp * 1000).toISOString()}};
  return {person: {...scope, originalLoginKey: loginKey, originalNameSuffix}, entry: {...scope, loginKey, groupKey: packet.groupName,
    groupLabel: packet.groupLabel, executionMode: packet.mode as 'run-hot-return', originalLoginIdentity: true as const}, run,
    personNumber: String(packet.personId), testNumber: String(packet.testId),
    unit: packet.unitName === undefined ? null : {...scope, unitName: packet.unitName, state: packet.unitState as Record<string, string>}};
}

test('native monitor projection reproduces all actual protected Source75 unopened packet bytes', () => {
  assert.equal(receipt.success, true); assert.equal(receipt.testMode, false); assert.equal(receipt.checks.length, 75);
  const actual = unopened.map(packet => {const input = native(packet); input.run.originalTestState = {}; input.run.originalResultState!.hasTestState = false; return projectOriginalMonitorSession(input);});
  assert.equal(formatOriginalMonitorSessionsJson(actual), unopenedBytes);
});
for (const [prefix, field] of [
  ['monitor projects current Unit state', 'opened'], ['monitor Test lock projection', 'locked'], ['monitor uses current imported Login', 'changed']
]) test('native monitor retains exact Source75 state fields: ' + prefix, () => {
  const packet = receipt.checks.find((row: {name: string}) => row.name.startsWith(prefix))[field];
  assert.deepEqual(JSON.parse(formatOriginalMonitorSessionsJson([projectOriginalMonitorSession(native(packet))])), [packet]);
});
test('native monitor fails closed for unknown numeric identity, clocks, ownership and Unit provenance', () => {
  const packet = receipt.checks.find((row: {name: string}) => row.name.startsWith('monitor projects current Unit state')).opened;
  for (const corrupt of [
    (input: ReturnType<typeof native>) => {input.personNumber = '0';},
    (input: ReturnType<typeof native>) => {input.person.originalNameSuffix = undefined as unknown as string;},
    (input: ReturnType<typeof native>) => {delete input.run.originalResultState!.lastTestModifiedAt;},
    (input: ReturnType<typeof native>) => {input.run.originalResultState!.lastOpenedAt = undefined;},
    (input: ReturnType<typeof native>) => {delete input.run.originalTestState;},
    (input: ReturnType<typeof native>) => {input.person.workspaceId = 'foreign';},
    (input: ReturnType<typeof native>) => {input.unit!.contentReleaseId = 'foreign';},
    (input: ReturnType<typeof native>) => {Object.assign(input.unit!, {unknownHistory: true});}
  ]) {const input = native(packet); corrupt(input); assert.throws(() => projectOriginalMonitorSession(input), (error: unknown) => (error as {statusCode?: number}).statusCode === 409);}
});
test('native monitor reads only saved native clocks and Unit state, independently of canonical payloads', () => {
  const input = native(unopened[0]);
  for (const key of ['status', 'currentUnitKey', 'unitResponses', 'controllerEntry', 'testletTimers']) Object.defineProperty(input.run, key, {get() {throw Error('Private canonical field was inspected.');}});
  input.run.originalTestState = {}; input.run.originalResultState!.hasTestState = false;
  assert.deepEqual(JSON.parse(formatOriginalMonitorSessionsJson([projectOriginalMonitorSession(input)])), [unopened[0]]);
});
test('native monitor keeps exact signed-int64 JSON IDs and Source empty-map/empty-string distinctions', () => {
  const input = native(unopened[0]); input.personNumber = '9007199254740993'; input.testNumber = '9223372036854775807'; input.entry.groupLabel = '';
  const wire = formatOriginalMonitorSessionsJson([projectOriginalMonitorSession(input)]);
  assert.ok(wire.includes('"personId":9007199254740993')); assert.ok(wire.includes('"testId":9223372036854775807'));
  assert.ok(wire.includes('"unitState":{}')); assert.ok(!wire.includes('"groupLabel"')); assert.ok(!wire.includes('"unitName"'));
  for (const value of ['', '0', false, 0, null, []]) {
    input.run.originalTestState = {CURRENT_UNIT_ID: value}; assert.equal(originalMonitorCurrentUnit(input.run), null);
  }
  input.run.originalTestState = {CURRENT_UNIT_ID: true}; assert.throws(() => originalMonitorCurrentUnit(input.run), TypeError);
});
test('native monitor default selection cannot reproduce the Source foreign-group exposure', () => {
  const actor: OriginalMonitorActor = {participantSessionId: 'owned-monitor', tenantId: 'owned-tenant', workspaceId: 'owned-workspace',
    originalLoginKey: 'monitor', groupKey: 'ORACLE.MONITOR', mode: 'monitor-group'};
  assert.equal(originalMonitorGroupSelection(actor), null);
  assert.equal(originalMonitorGroupSelection(actor, 'oracle.monitor'), actor.groupKey);
  assert.throws(() => originalMonitorGroupSelection(actor, 'ORACLE.MONITOR.PEER'), (error: unknown) => (error as {statusCode?: number}).statusCode === 403);
  assert.equal(originalMonitorGroupSelection({...actor, groupKey: '0'}), '0');
  assert.equal(originalMonitorGroupSelection({...actor, mode: 'monitor-study'}), undefined);
  assert.equal(originalMonitorGroupSelection({...actor, mode: 'monitor-study'}, 'ORACLE.MONITOR.PEER'), 'ORACLE.MONITOR.PEER');
});
