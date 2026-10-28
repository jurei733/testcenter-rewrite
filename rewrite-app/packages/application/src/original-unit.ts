import {originalUnitLogIdPrefix} from '@testcenter-rewrite-app/domain';
import type {OriginalNativeUnit,ParticipantTestLog} from '@testcenter-rewrite-app/domain';
import type {FirstSliceRepository} from './index.js';
import type {OriginalAuthenticationPort} from './original-authentication.js';
import {FirstSliceError} from './first-slice-error.js';
import {resolveOriginalOwnedTestScope} from './original-test-access.js';
import {assertOriginalUnitInput,originalUnitText,originalUnitHistoryUnavailable,patchOriginalUnitState,patchOriginalUnitParts,type OriginalUnitInput} from './original-unit-record.js';
import {encodeOriginalReportJson} from './original-workspace-report-wire.js';
import {parseOriginalTestStatePatch} from './original-test-state.js';
export type OriginalUnitRead={state:Record<string,string>;dataParts:Array<[string,string|null]>;unitResponseType:string;definition:string;definitionType:string};
export function formatOriginalUnitReadJson(value:OriginalUnitRead):string{
 const fields=Object.entries(value.state).sort(([a],[b])=>Buffer.byteLength(a)-Buffer.byteLength(b)||Buffer.compare(Buffer.from(a),Buffer.from(b)));
 const object=(entries:Array<[string,unknown]>)=>'{'+entries.map(([key,item])=>encodeOriginalReportJson(key)+':'+encodeOriginalReportJson(item)).join(',')+'}';
 return '{"state":'+object(fields)+',"dataParts":'+object(value.dataParts)+',"unitResponseType":'+encodeOriginalReportJson(value.unitResponseType)+',"definition":'+encodeOriginalReportJson(value.definition)+',"definitionType":'+encodeOriginalReportJson(value.definitionType)+'}';
}
type Request={token:string;testNumber:string;unitName:string};
export type OriginalUnitPort={read(input:Request&{alias?:string}):Promise<OriginalUnitRead>;patchState(input:Request&{body:unknown}):Promise<void>;putResponse(input:Request&{body:unknown}):Promise<void>;putLog(input:Request&{body:unknown}):Promise<void>};
export function createOriginalUnitPort(input:{repository:FirstSliceRepository;auth:OriginalAuthenticationPort;now:()=>string;id:()=>string;file:(scope:{tenantId:string;workspaceId:string},unitName:string)=>Promise<{definition:string;definitionType:string}>}):OriginalUnitPort{
 const scope=async(request:Request,alias=request.unitName)=>{const{person,scope:run}=await resolveOriginalOwnedTestScope(input,request.token,request.testNumber);const value:OriginalUnitInput={testRunId:run.testRunId,participantSessionId:run.participantSessionId,tenantId:run.tenantId,workspaceId:run.workspaceId,contentReleaseId:run.contentReleaseId,unitName:alias};assertOriginalUnitInput(value);return{person,value};};
 const log=(value:OriginalUnitInput,unit:OriginalNativeUnit|null,key:string,content:string,timeStamp:number,timestamp:string):ParticipantTestLog=>({participantTestLogId:originalUnitLogIdPrefix+input.id(),tenantId:value.tenantId,workspaceId:value.workspaceId,participantSessionId:value.participantSessionId,testRunId:value.testRunId,unitKey:unit?.unitName??value.unitName,originalUnitId:unit?.originalUnitId??'',logKey:key,logContent:content,timestamp:timeStamp,recordedAt:timestamp,...(timeStamp===0?{originalTimestamp:0 as const}:{})});
 return{
  async read(request){const alias=request.alias&&request.alias!=='0'?request.alias:request.unitName,{person,value}=await scope(request,alias);originalUnitText(request.unitName,255);
   let file;try{file=await input.file(person,request.unitName);}catch(error){if(error instanceof FirstSliceError&&error.statusCode===404){const id=await input.repository.getOrCreateOriginalWorkspaceNumber(person);throw new FirstSliceError(404,'original_unit_file_unavailable',`No Unit with id \`${request.unitName}\` found on workspace \`${id}\`!`);}throw error;}
   const unit=await input.repository.getOriginalUnit(value);if(unit?.unknownHistory)throw originalUnitHistoryUnavailable();
   return{...file,state:unit?.state??{},dataParts:unit?.parts.map(part=>[part.id,part.content] as [string,string|null])??[],unitResponseType:unit?.parts.at(-1)?.responseType??''};
  },
  async patchState(request){const{value}=await scope(request);await input.repository.mutateOriginalUnit(value,previous=>{const{unit,entries}=patchOriginalUnitState(value,previous,request.body),timestamp=input.now();return{unit,logs:entries.map(entry=>log(value,unit,entry.key,entry.content as string,entry.timeStamp,timestamp))};});},
  async putResponse(request){const{value}=await scope(request);await input.repository.mutateOriginalUnit(value,previous=>({unit:patchOriginalUnitParts(previous,request.body),logs:[]}));},
  async putLog(request){const{value}=await scope(request),body=request.body&&typeof request.body==='object'&&!Array.isArray(request.body)?(request.body as Record<string,unknown>).logEntries:request.body;
   if(!Array.isArray(body))throw new FirstSliceError(400,'original_unit_log_invalid','body has to be an array');
   const entries=parseOriginalTestStatePatch(body.map(row=>row&&typeof row==='object'?{...row,content:row.content??''}:row));
   await input.repository.mutateOriginalUnit(value,previous=>{const timestamp=input.now();return{logs:entries.map(entry=>log(value,previous,entry.key,encodeOriginalReportJson(entry.content),entry.timeStamp,timestamp))};});
  }
 };
}
