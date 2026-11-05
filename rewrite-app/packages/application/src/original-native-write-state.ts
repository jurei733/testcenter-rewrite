import type {OriginalNativeStateWriteBase, OriginalNativeStateWriteResult, OriginalNativeWriteGuard, OriginalTestResultState} from '@testcenter-rewrite-app/domain';
import {FirstSliceError} from './first-slice-error.js';
import type {OriginalTestStateEntry} from './original-test-state.js';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const integer = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) >= 0;
const invalid = () => new FirstSliceError(400, 'original_state_base_invalid', 'Invalid native Test-state write base.');
const controlKeys = new Set(['CURRENT_UNIT_ID', 'TESTLETS_TIMELEFT', 'TESTLETS_CLEARED_CODE',
  'TESTLETS_LOCKED_AFTER_LEAVE', 'BOOKLET_STATES', 'UNITS_LOCKED_AFTER_LEAVE', 'CONTROLLER']);
export const isOriginalNativeControlKey = (key: string): boolean => controlKeys.has(key);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' &&
  !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function versions(value: unknown, revision: number): asserts value is Record<string, number> {
  if (!record(value) || Object.keys(value).length > 10000 || Object.values(value).some(n => !integer(n) || n > revision)) throw invalid();
}
export function assertOriginalNativeWriteGuard(value: unknown): asserts value is OriginalNativeWriteGuard {
  if (!record(value) || value.version !== 1 || !integer(value.revision) || !integer(value.controlEpoch) || value.controlEpoch > value.revision) throw invalid();
  versions(value.fields, value.revision);
}
export function initialOriginalNativeWriteGuard(): OriginalNativeWriteGuard {
  return {version: 1, revision: 0, controlEpoch: 0, fields: {}};
}
export function readOriginalNativeStateBase(evidence:OriginalTestResultState|undefined):OriginalNativeStateWriteBase{
  if(!evidence?.nativeWriteGuard)throw new FirstSliceError(409,'original_state_protocol_required','Read the current native Test-state base before acknowledging commands.');
  assertOriginalNativeWriteGuard(evidence.nativeWriteGuard);
  return {version:1,revision:evidence.nativeWriteGuard.revision,controlEpoch:evidence.nativeWriteGuard.controlEpoch};
}
export function advanceOriginalNativeWriteGuard(before: OriginalNativeWriteGuard, keys: string[], control = keys.some(isOriginalNativeControlKey)): OriginalNativeWriteGuard {
  assertOriginalNativeWriteGuard(before);
  if (!keys.length && !control) return structuredClone(before);
  const revision = before.revision + 1, controlEpoch = before.controlEpoch + Number(control);
  if (!integer(revision) || !integer(controlEpoch)) throw invalid();
  const fields = new Map(Object.entries(before.fields));
  for (const key of keys) fields.set(key, revision);
  const result: OriginalNativeWriteGuard = {version: 1, revision, controlEpoch, fields: Object.fromEntries(fields)};
  assertOriginalNativeWriteGuard(result); return result;
}
export function parseOriginalNativeStateWriteBase(value: unknown): OriginalNativeStateWriteBase | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') { if (value.length > 8192) throw invalid(); try { value = JSON.parse(value); } catch { throw invalid(); } }
  if (!record(value) || value.version !== 1 || !integer(value.revision) || !integer(value.controlEpoch) || value.controlEpoch > value.revision ||
    Object.keys(value).some(key => !['version','revision','controlEpoch','previousDeliveryId','segments'].includes(key)) ||
    value.previousDeliveryId !== undefined && (typeof value.previousDeliveryId !== 'string' || !uuid.test(value.previousDeliveryId))) throw invalid();
  let previous=0;
  if(value.segments!==undefined&&(!Array.isArray(value.segments)||!value.segments.length||value.segments.length>32||value.segments.some(segment=>{
    if(!record(segment)||!integer(segment.start)||segment.start<=previous||!integer(segment.revision)||!integer(segment.controlEpoch)||segment.controlEpoch>segment.revision||Object.keys(segment).some(key=>!['start','revision','controlEpoch'].includes(key)))return true;
    previous=segment.start;return false;
  })))throw invalid();
  return {version: 1, revision: value.revision, controlEpoch: value.controlEpoch,
    ...(value.previousDeliveryId === undefined ? {} : {previousDeliveryId: value.previousDeliveryId as string}),
    ...(value.segments===undefined?{}:{segments:structuredClone(value.segments) as OriginalNativeStateWriteBase['segments']})};
}
export function assertOriginalNativeStateWriteResult(value: unknown): asserts value is OriginalNativeStateWriteResult {
  if (!record(value) || value.version !== 1 || !integer(value.revision) || !integer(value.controlEpoch) || value.controlEpoch > value.revision ||
    !integer(value.controlBase) || value.controlBase > value.controlEpoch ||
    !Array.isArray(value.appliedKeys) || !Array.isArray(value.supersededKeys) || value.currentSuperseded!==undefined&&typeof value.currentSuperseded!=='boolean' ||
    [...value.appliedKeys, ...value.supersededKeys].some(key => typeof key !== 'string')) throw invalid();
  versions(value.fieldBases, value.revision);
}
/** Carry only successful causal field versions through a predecessor. Its global
 * revision may include another writer: using that revision would bless stale data. */
export function prepareOriginalNativeStateWrite(before: OriginalNativeWriteGuard, base: OriginalNativeStateWriteBase,
  entries: OriginalTestStateEntry[], predecessor?: OriginalNativeStateWriteResult): {entries: OriginalTestStateEntry[]; result: OriginalNativeStateWriteResult} {
  assertOriginalNativeWriteGuard(before);
  if (base.previousDeliveryId && !predecessor) throw new FirstSliceError(425, 'original_state_dependency_pending', 'The preceding Test-state delivery has not been accepted.');
  if (predecessor) assertOriginalNativeStateWriteResult(predecessor);
  if (base.revision > before.revision || base.controlEpoch > before.controlEpoch || predecessor && predecessor.revision > before.revision) throw invalid();
  const fieldBases = new Map(Object.entries(predecessor?.fieldBases ?? {}));
  let controlBase = Math.max(base.controlEpoch, predecessor?.controlBase ?? 0),context=base;
  const applied=new Set<string>(),superseded=new Set<string>(),applicable:OriginalTestStateEntry[]=[];
  const currentApplied=new Set<string>(),currentRejected=new Set<string>(),currentStart=base.segments?.at(-1)?.start??0;
  for(const segment of base.segments??[])if(segment.start>=entries.length||segment.revision>before.revision||segment.controlEpoch>before.controlEpoch)throw invalid();
  for(const[index,entry]of entries.entries()){
    const segment=base.segments?.find(segment=>segment.start===index);if(segment)context={version:1,...segment};
    const causalControl=Math.max(context.controlEpoch,predecessor?.controlBase??0);controlBase=Math.max(controlBase,causalControl);
    if(entry.timeStamp<=0)continue;
    const key=entry.key,allowed=(Object.hasOwn(before.fields,key)?before.fields[key]!:0)<=Math.max(context.revision,fieldBases.get(key)??0)&&(!isOriginalNativeControlKey(key)||causalControl===before.controlEpoch);
    if(allowed){applied.add(key);applicable.push(entry);if(index>=currentStart)currentApplied.add(key);}else {superseded.add(key);if(index>=currentStart)currentRejected.add(key);}
  }
  const appliedKeys=[...applied],supersededKeys=[...superseded].filter(key=>!applied.has(key));
  const after = advanceOriginalNativeWriteGuard(before, appliedKeys);
  for (const key of appliedKeys) fieldBases.set(key, after.revision);
  const result: OriginalNativeStateWriteResult = {version: 1, revision: after.revision, controlEpoch: after.controlEpoch,
    fieldBases: Object.fromEntries(fieldBases), controlBase: appliedKeys.some(isOriginalNativeControlKey) ? after.controlEpoch : controlBase,
    appliedKeys, supersededKeys, ...(base.segments?{currentSuperseded:[...currentRejected].some(key=>!currentApplied.has(key))}:{})};
  assertOriginalNativeStateWriteResult(result);
  return {entries: applicable, result};
}
