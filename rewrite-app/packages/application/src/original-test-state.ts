import type {TestRun} from '@testcenter-rewrite-app/domain';
import {FirstSliceError} from './first-slice-error.js';
import {encodeOriginalReportJson} from './original-workspace-report-wire.js';
export type OriginalTestState=Record<string,unknown>;
export type OriginalTestStateEntry={key:string;content:unknown;timeStamp:number};
const invalid=()=>new FirstSliceError(400,'original_test_state_invalid','The Test state patch is invalid.');
const text=(value:string)=>{for(const c of value)if(c==='\0'||c.length===1&&c.charCodeAt(0)>=0xd800&&c.charCodeAt(0)<=0xdfff)throw invalid();};
function json(value:unknown,depth=0):void{
  if(depth>64)throw invalid();
  if(typeof value==='string'){text(value);return;}
  if(value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return;
  if(Array.isArray(value)){for(const item of value)json(item,depth+1);return;}
  if(value&&typeof value==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(value))){for(const[key,item]of Object.entries(value)){text(key);json(item,depth+1);}return;}
  throw invalid();
}
export function assertOriginalTestState(value:unknown):asserts value is OriginalTestState{
  if(!value||typeof value!=='object'||Array.isArray(value))throw invalid();json(value);
  if(Object.keys(value).length>10000||Buffer.byteLength(encodeOriginalReportJson(value),'utf8')>5*1024*1024)throw invalid();
}
export function parseOriginalTestStatePatch(input:unknown):OriginalTestStateEntry[]{
  if(!Array.isArray(input))throw new FirstSliceError(400,'original_test_state_invalid','body has to be an array');
  return input.map(row=>{
    if(!row||typeof row!=='object'||Array.isArray(row))throw invalid();
    for(const key of ['key','content','timeStamp'])if(row[key]===null||row[key]===undefined)throw new FirstSliceError(400,'original_request_invalid','Required body-parameter is missing: `'+key+'`');
    if(typeof row.key!=='string'||typeof row.timeStamp!=='number'||!Number.isSafeInteger(row.timeStamp)||Math.abs(row.timeStamp)>8640000000000000)throw invalid();text(row.key);json(row.content);
    return{key:row.key,content:structuredClone(row.content),timeStamp:row.timeStamp};
  });
}
/** TestDAO resets update timestamps for each packet; UnitDAO does not. */
export function applyOriginalTestStatePatch(previous:OriginalTestState,entries:OriginalTestStateEntry[]):OriginalTestState{
  assertOriginalTestState(previous);const values=new Map(Object.entries(previous)),clocks=new Map<string,number>();
  for(const entry of entries){if((clocks.get(entry.key)??0)>=entry.timeStamp)continue;clocks.set(entry.key,entry.timeStamp);
    values.set(entry.key,entry.content&&typeof entry.content==='object'&&!Array.isArray(entry.content)?encodeOriginalReportJson(entry.content):structuredClone(entry.content));}
  const result=Object.fromEntries(values);assertOriginalTestState(result);return result;
}
export function originalPhpMap(entries:Array<[string,unknown]>):string{
  if(entries.every(([key],index)=>key===String(index)))return '['+entries.map(([,value])=>encodeOriginalReportJson(value)).join(',')+']';
  return '{'+entries.map(([key,value])=>encodeOriginalReportJson(key)+':'+encodeOriginalReportJson(value)).join(',')+'}';
}

/** Generic stale snapshots cannot rewind independently committed native state. */
export function preserveOriginalTestState(next:TestRun,previous:Pick<TestRun,'testRunId'|'participantSessionId'|'tenantId'|'workspaceId'|'contentReleaseId'|'originalTestState'|'originalResultState'|'stateRevision'>|null):TestRun{
 if(!previous)return next;
 const result={...next};delete result.originalTestState;
 if(previous.originalTestState!==undefined){
  if((['testRunId','participantSessionId','tenantId','workspaceId','contentReleaseId'] as const).some(key=>previous[key]!==next[key]))throw new FirstSliceError(409,'original_test_scope_changed','The native Test scope changed.');
  result.originalTestState=structuredClone(previous.originalTestState);
  if(previous.originalResultState!==undefined)result.originalResultState=structuredClone(previous.originalResultState);
  if(previous.stateRevision!==undefined)result.stateRevision=previous.stateRevision;
 }
 return result;
}
