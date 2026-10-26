import {assertOriginalTestState} from './original-test-state.js';
import { defaultParticipantExecutionMode, participantExecutionModeDefinitions } from "@testcenter-rewrite-app/domain";
import type { OriginalTestResultState, TestRun } from '@testcenter-rewrite-app/domain';

const testFields = ['status','pauseSource','currentUnitKey','bookletStates','bookletStateOverrides',
  'unlockedTestletKeys','monitorNavigationUnlocked','testletTimers','lockedTestletKeys','lockedUnitKeys','sharedParameters'] as const;
const fieldValue = (run: TestRun, key: typeof testFields[number]): unknown => {
  if (['locked','monitorNavigationUnlocked'].includes(key)) return run[key] ?? false;
  if (['bookletStates','bookletStateOverrides','testletTimers'].includes(key)) return run[key] ?? {};
  if (['unlockedTestletKeys','lockedTestletKeys','lockedUnitKeys','sharedParameters'].includes(key)) return run[key] ?? [];
  return run[key] ?? null;
};
const time = (value: unknown): string => {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw Error('Original result evidence requires a server timestamp.');
  return new Date(value).toISOString();
};

/** Reconstruct this server-owned projection from the currently locked record.
 * Unit answers, Unit logs/reviews and Run.updatedAt alone do not advance the
 * Original's Test timestamp. Legacy unknown evidence is never fabricated. */
export function withOriginalResultState(previous: TestRun, projected: TestRun,
  input: {openedAt?: string; testStateAt?: string; modifiedAt?: string; nativeTestState?: Record<string,unknown>} = {}): TestRun {
  const before = previous.originalResultState;
  if (before !== undefined && (!before || typeof before !== 'object' || Array.isArray(before) ||
    before.hasTestState !== undefined && typeof before.hasTestState !== 'boolean')) {
    throw Error('Invalid persisted Original result evidence.');
  }
  if (before && (before.bookletName !== undefined || before.bookletLabel !== undefined) &&
      (typeof before.bookletName !== 'string' || !before.bookletName.trim() || typeof before.bookletLabel !== 'string')) {
    throw Error('Invalid persisted Original Test identity.');
  }
  for (const field of ['lastOpenedAt','lastTestStateAt','lastTestModifiedAt'] as const) {
    if (before?.[field] !== undefined && before[field] !== null) time(before[field]);
  }
  const openedAt = input.openedAt === undefined ? undefined : time(input.openedAt);
  if(input.nativeTestState!==undefined)assertOriginalTestState(input.nativeTestState);
  let stateAt = input.nativeTestState!==undefined?time(projected.updatedAt):input.testStateAt === undefined ? undefined : time(input.testStateAt);
  const mode = previous.executionMode && Object.hasOwn(participantExecutionModeDefinitions, previous.executionMode)
    ? previous.executionMode : defaultParticipantExecutionMode;
  const saveState = participantExecutionModeDefinitions[mode].saveResponses;
  if (stateAt !== undefined && !saveState && input.nativeTestState===undefined) throw Error('A non-saving execution mode cannot persist Original Test state.');
  if (stateAt === undefined && saveState && before !== undefined && testFields.some(key =>
    JSON.stringify(fieldValue(previous, key)) !== JSON.stringify(fieldValue(projected, key)))) stateAt = time(projected.updatedAt);
  const modifiedAt = input.modifiedAt !== undefined ? time(input.modifiedAt) :
    stateAt ?? openedAt ?? ((previous.locked ?? false) !== (projected.locked ?? false) ? time(projected.updatedAt) : undefined);
  const result = {...projected};
  // Ordinary stale Run writes cannot replace server-owned native state.
  if(input.nativeTestState!==undefined)result.originalTestState=structuredClone(input.nativeTestState);
  else if(previous.originalTestState!==undefined&&stateAt===undefined)result.originalTestState=structuredClone(previous.originalTestState);
  else delete result.originalTestState;
  if (before === undefined && openedAt === undefined && stateAt === undefined && modifiedAt === undefined) {
    delete result.originalResultState;
    return result;
  }
  const evidence: OriginalTestResultState = {...before,
    ...(openedAt === undefined ? {} : {lastOpenedAt: openedAt}),
    ...(stateAt === undefined ? {} : {lastTestStateAt: stateAt, hasTestState: input.nativeTestState===undefined?true:Object.keys(input.nativeTestState).length>0}),
    ...(modifiedAt === undefined ? {} : {lastTestModifiedAt: modifiedAt})};
  return {...result, originalResultState: evidence};
}
