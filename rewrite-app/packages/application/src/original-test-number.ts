import type {ParticipantSession, TestRun} from '@testcenter-rewrite-app/domain';
import {resultParentUnavailable} from './result-artifact-parent.js';

export type OriginalTestNumberScope = Pick<TestRun, 'testRunId' | 'participantSessionId' | 'tenantId' | 'workspaceId' | 'contentReleaseId'>;
export type OriginalTestNumberRecord = OriginalTestNumberScope & {testNumber: string};
export type OriginalTestNumberRun = Pick<TestRun,'testRunId'|'participantSessionId'|'tenantId'|'workspaceId'|'contentReleaseId'|'originalResultState'>;
export type OriginalTestNumberInput = OriginalTestNumberScope & {consumeSequence?: boolean};
const keys = ['testRunId', 'participantSessionId', 'tenantId', 'workspaceId', 'contentReleaseId'] as const;
const maximum = 9223372036854775807n;
const counterValue = (value: string): bigint => {
  if (typeof value !== 'string' || !/^(?:0|[1-9][0-9]{0,18})$/.test(value)) throw new Error('Invalid persisted native Test counter.');
  const number = BigInt(value);
  if (number > maximum) throw new Error('Invalid persisted native Test counter.');
  return number;
};

/** IDs remain decimal strings internally, including values above JS safe integers.
 * Only a currently owned native Run with known first identity may acquire one. */
export function prepareOriginalTestNumber(input: OriginalTestNumberInput, run: OriginalTestNumberRun | null,
  person: ParticipantSession | null, existing: OriginalTestNumberRecord | undefined, counter: string): {
    record: OriginalTestNumberRecord; counter: string; changed: boolean;
  } {
  if (keys.some(key => typeof input[key] !== 'string' || !input[key]) || input.consumeSequence !== undefined && typeof input.consumeSequence !== 'boolean') throw new TypeError('A native Test number requires its immutable scope.');
  if (!run || !person || keys.some(key => run[key] !== input[key]) || person.participantSessionId !== input.participantSessionId ||
      person.tenantId !== input.tenantId || person.workspaceId !== input.workspaceId || person.contentReleaseId !== input.contentReleaseId ||
      typeof person.originalLoginKey !== 'string' || typeof person.originalNameSuffix !== 'string') throw resultParentUnavailable();
  if (typeof run.originalResultState?.bookletName !== 'string' || !run.originalResultState.bookletName || typeof run.originalResultState.bookletLabel !== 'string') {
    throw new Error('A native Test number requires observed first Test identity.');
  }
  const current = counterValue(counter);
  if (existing && (keys.some(key => existing[key] !== input[key]) || counterValue(existing.testNumber) === 0n || BigInt(existing.testNumber) > current)) {
    throw new Error('Invalid persisted native Test number scope.');
  }
  if (existing && !input.consumeSequence) return {record: {...existing}, counter, changed: false};
  if (current === maximum) throw new Error('Native Test number space is exhausted.');
  const next = (current + 1n).toString();
  return {record: existing ? {...existing} : Object.fromEntries([...keys.map(key => [key, input[key]]), ['testNumber', next]]) as OriginalTestNumberRecord,
    counter: next, changed: true};
}


/** The native creation path cannot smuggle controller entry or result payloads. */
export function assertOriginalTestCreationCandidate(run: TestRun): void {
  if (run.status !== 'created' || run.currentUnitKey !== null || run.locked === true || Object.keys(run.unitResponses).length ||
      run.controllerEntry !== undefined || Object.keys(run.testletTimers ?? {}).length ||
      run.originalResultState?.lastOpenedAt !== null || run.originalResultState.hasTestState !== false || run.originalResultState.lastTestStateAt !== null) {
    throw new TypeError('Native Test creation requires an unopened, response-free candidate.');
  }
}

export function selectOwnedOriginalTestNumber(input:{testNumber:string;tenantId:string;workspaceId:string;participantSessionId:string},record:OriginalTestNumberRecord|undefined,run:TestRun|null,person:ParticipantSession|null):OriginalTestNumberRecord|null{
  if(!record||!run||!person||record.testNumber!==input.testNumber||['tenantId','workspaceId','participantSessionId'].some(key=>record[key as keyof typeof input]!==input[key as keyof typeof input])||keys.some(key=>run[key]!==record[key])||person.participantSessionId!==record.participantSessionId||person.tenantId!==record.tenantId||person.workspaceId!==record.workspaceId||person.contentReleaseId!==record.contentReleaseId||person.originalLoginKey===undefined||person.originalNameSuffix===undefined)return null;
  return{...record};
}
