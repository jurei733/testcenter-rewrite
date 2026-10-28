import type {OriginalNativeUnit, ParticipantSession, ParticipantTestLog, TestRun} from '@testcenter-rewrite-app/domain';
import {FirstSliceError} from './first-slice-error.js';
import {resultParentUnavailable} from './result-artifact-parent.js';
import {originalParticipantGroupKeysEqual} from './original-participant-group.js';
import {assertOriginalTestState,parseOriginalTestStatePatch} from './original-test-state.js';

export type OriginalUnitScope=Pick<TestRun,'testRunId'|'participantSessionId'|'tenantId'|'workspaceId'|'contentReleaseId'>;
export type OriginalUnitInput=OriginalUnitScope&{unitName:string};
export type OriginalUnitEffect={unit?:OriginalNativeUnit;logs:ParticipantTestLog[]};
export type OriginalUnitTransform=(previous:OriginalNativeUnit|null)=>OriginalUnitEffect;
const keys=['testRunId','participantSessionId','tenantId','workspaceId','contentReleaseId'] as const;
const invalid=()=>new FirstSliceError(400,'original_unit_invalid','The native Unit payload is invalid.');
export const originalUnitHistoryUnavailable=()=>new FirstSliceError(409,'original_unit_history_unknown','The historical native Unit state is unavailable.');
export function originalUnitText(value:unknown,max?:number):asserts value is string{
 if(typeof value!=='string'||max!==undefined&&Array.from(value).length>max)throw invalid();
 for(const c of value)if(c==='\0'||c.length===1&&c.charCodeAt(0)>=0xd800&&c.charCodeAt(0)<=0xdfff)throw invalid();
}
export function assertOriginalUnitInput(input:OriginalUnitInput):void{
 for(const key of keys)if(typeof input[key]!=='string'||!input[key].length)throw invalid();
 originalUnitText(input.unitName,255);if(!input.unitName.length||/[\/\\\u0000-\u001f\u007f]/.test(input.unitName))throw invalid();
}
export function originalUnitParentMatches(input:OriginalUnitScope,run:OriginalUnitScope|null|undefined):boolean{
 return Boolean(run&&keys.every(key=>run[key]===input[key]));
}
export function assertOriginalUnitParent(input:OriginalUnitInput,run:OriginalUnitScope|null|undefined,person:Pick<ParticipantSession,'participantSessionId'|'tenantId'|'workspaceId'|'contentReleaseId'>|null|undefined):void{
 assertOriginalUnitInput(input);if(!originalUnitParentMatches(input,run)||!person||(['participantSessionId','tenantId','workspaceId','contentReleaseId'] as const).some(key=>person[key]!==input[key]))throw resultParentUnavailable();
}
export function originalUnitRecordKey(unit:Pick<OriginalNativeUnit,'testRunId'|'unitName'>):string{return JSON.stringify([unit.testRunId,unit.unitName]);}
export function selectOriginalUnitName(input:OriginalUnitInput,names:readonly string[]):string|null{
 assertOriginalUnitInput(input);const matches=names.filter(name=>originalParticipantGroupKeysEqual(name,input.unitName));
 if(matches.length>1)throw new FirstSliceError(409,'original_unit_ambiguous','The stored Unit identity is ambiguous.');return matches[0]??null;
}
export function assertOriginalUnitRecord(unit:OriginalNativeUnit):void{
 if(unit.unknownHistory!==undefined&&unit.unknownHistory!==true)throw invalid();
 assertOriginalUnitInput(unit);originalUnitText(unit.unitName,50);originalUnitText(unit.originalUnitId,255);assertOriginalTestState(unit.state);assertOriginalTestState(unit.stateClocks);
 for(const value of Object.values(unit.state))originalUnitText(value);
 for(const[key,value]of Object.entries(unit.stateClocks))if(!Number.isSafeInteger(value)||value<0||value>0&&!Object.hasOwn(unit.state,key))throw invalid();
 for(const key of Object.keys(unit.state))if(!Object.hasOwn(unit.stateClocks,key))throw invalid();
 if(!Array.isArray(unit.parts)||unit.parts.length>10000||new Set(unit.parts.map(part=>part.id)).size!==unit.parts.length)throw invalid();
 for(const part of unit.parts){originalUnitText(part.id,50);originalUnitText(part.responseType,50);if(part.content!==null)originalUnitText(part.content);if(!Number.isSafeInteger(part.ts))throw invalid();}
 if(Buffer.byteLength(JSON.stringify(unit),'utf8')>5*1024*1024)throw invalid();
}
export function prepareOriginalUnitMutation(input:OriginalUnitInput,previous:OriginalNativeUnit|null,transform:OriginalUnitTransform):OriginalUnitEffect{
 assertOriginalUnitInput(input);if(previous){assertOriginalUnitRecord(previous);if(!originalUnitParentMatches(input,previous)||!originalParticipantGroupKeysEqual(previous.unitName,input.unitName))throw invalid();}
 const effect=structuredClone(transform(structuredClone(previous)));
 if(effect.unit){const unit=effect.unit;assertOriginalUnitRecord(unit);if(!originalUnitParentMatches(input,unit)||!originalParticipantGroupKeysEqual(unit.unitName,input.unitName)||previous&&(unit.unitName!==previous.unitName||unit.originalUnitId!==previous.originalUnitId))throw invalid();}
 if(!Array.isArray(effect.logs)||effect.logs.some(log=>!keys.filter(key=>key!=='contentReleaseId').every(key=>log[key]===input[key])||typeof log.unitKey!=='string'||!originalParticipantGroupKeysEqual(log.unitKey,input.unitName)))throw invalid();
 if(new Set(effect.logs.map(log=>log.participantTestLogId)).size!==effect.logs.length)throw Error('Native Unit log identity collision.');return effect;
}
export function patchOriginalUnitState(input:OriginalUnitInput,previous:OriginalNativeUnit|null,body:unknown):{unit:OriginalNativeUnit;entries:ReturnType<typeof parseOriginalTestStatePatch>}{
 const object=!Array.isArray(body)&&body&&typeof body==='object'?body as Record<string,unknown>:null;
 const entries=parseOriginalTestStatePatch(object?object.newState:body);for(const entry of entries)originalUnitText(entry.content);
 const originalUnitId=object?.originalUnitId??'';originalUnitText(originalUnitId,255);
 if(previous?.unknownHistory)throw originalUnitHistoryUnavailable();
 const unit:OriginalNativeUnit=previous?structuredClone(previous):{testRunId:input.testRunId,participantSessionId:input.participantSessionId,tenantId:input.tenantId,workspaceId:input.workspaceId,contentReleaseId:input.contentReleaseId,unitName:input.unitName,originalUnitId,state:{},stateClocks:{},parts:[]};
 const values=new Map(Object.entries(unit.state)),clocks=new Map(Object.entries(unit.stateClocks));
 for(const entry of entries){if(!clocks.has(entry.key))clocks.set(entry.key,0);if(entry.timeStamp>clocks.get(entry.key)!){values.set(entry.key,entry.content as string);clocks.set(entry.key,entry.timeStamp);}}
 unit.state=Object.fromEntries(values);unit.stateClocks=Object.fromEntries(clocks);assertOriginalUnitRecord(unit);return{unit,entries};
}
export function patchOriginalUnitParts(previous:OriginalNativeUnit|null,body:unknown):OriginalNativeUnit{
 if(!body||typeof body!=='object'||Array.isArray(body))throw invalid();const value=body as Record<string,unknown>,ts=value.timeStamp;
 if(!Number.isSafeInteger(ts))throw invalid();const parts=value.dataParts??{},type=value.responseType??'unknown';originalUnitText(type,50);
 if(!parts||typeof parts!=='object')throw invalid();
 if(!previous)throw new FirstSliceError(404,'original_unit_uninitialized','Unit response could not be saved because the unit does not exist (yet). Please try again.');
 if(previous.unknownHistory)throw originalUnitHistoryUnavailable();
 const next=structuredClone(previous),byId=new Map(next.parts.map(part=>[part.id,part]));
 for(const[id,content]of Object.entries(parts)){originalUnitText(id,50);if(content!==null)originalUnitText(content);const old=byId.get(id);
  if(old&&old.ts>=(ts as number))continue;byId.delete(id);byId.set(id,{id,content,ts:ts as number,responseType:type});}
 next.parts=[...byId.values()];assertOriginalUnitRecord(next);return next;
}
