import {participantExecutionModeDefinitions} from '@testcenter-rewrite-app/domain';
import type {OriginalNativeUnit,ParticipantSession,WorkspaceReview} from '@testcenter-rewrite-app/domain';
import {FirstSliceError} from './first-slice-error.js';
import {originalParticipantGroupKeysEqual} from './original-participant-group.js';
import {assertOriginalUnitInput,assertOriginalUnitRecord,originalUnitParentMatches,originalUnitText,createOriginalUnitRecord,type OriginalUnitScope} from './original-unit-record.js';
import {encodeOriginalReportJson} from './original-workspace-report-wire.js';

export type OriginalReviewScope=OriginalUnitScope&{unitName:string|null};
export type OriginalNativeReview=OriginalReviewScope&{
  reviewId:string;reviewNumber:string;testNumber:string;personNumber:string;
  priority:0|1|2|3;categories:string;entry:string;reviewer:string|null;
  page:string|null;pageLabel:string|null;userAgent:string;originalUnitId:string;
  createdAt:string;updatedAt:string;
};
export type OriginalReviewMutation={action:'create';body:unknown;reviewId:string;at:string}|
  {action:'update';body:unknown;reviewNumber:string;at:string}|{action:'delete';reviewNumber:string};
export type OriginalReviewContext={previous:OriginalNativeReview|null;unit:OriginalNativeUnit|null;counter:string;
  person:Pick<ParticipantSession,'executionMode'|'originalOperationalMode'>;testNumber:string;personNumber:string};
export type OriginalReviewEffect={review:OriginalNativeReview|null;projection:WorkspaceReview|null;
  unit?:OriginalNativeUnit;counter:string;deletedReviewId?:string};
const invalid=()=>new FirstSliceError(400,'original_review_invalid','The native Review payload is invalid.');
export const originalReviewHistoryUnavailable=()=>new FirstSliceError(409,'original_review_history_unknown','The historical native Review identity is unavailable.');
const maximum=9223372036854775807n;
export function originalReviewNumber(value:string,allowZero=false):string{
  if(typeof value!=='string'||!/^\d+$/.test(value)||value.length>256||BigInt(value)>maximum||(!allowZero&&BigInt(value)===0n))throw invalid();
  return BigInt(value).toString();
}
export function originalReviewKey(row:Pick<OriginalNativeReview,'unitName'|'reviewNumber'>):string{
  return JSON.stringify([row.unitName===null?'test':'unit',originalReviewNumber(row.reviewNumber)]);
}
export function assertOriginalReviewScope(scope:OriginalReviewScope):void{
  assertOriginalUnitInput({...scope,unitName:scope.unitName??'__booklet_review__'});
}
export function originalReviewScopeMatches(scope:OriginalReviewScope,row:OriginalNativeReview):boolean{
  return originalUnitParentMatches(scope,row)&&(scope.unitName===null?row.unitName===null:
    row.unitName!==null&&originalParticipantGroupKeysEqual(scope.unitName,row.unitName));
}
export function requireOriginalReviewMode(person:OriginalReviewContext['person']):void{
  const mode=person.originalOperationalMode??person.executionMode??'run-demo';
  if(!Object.hasOwn(participantExecutionModeDefinitions,mode)||!participantExecutionModeDefinitions[mode as keyof typeof participantExecutionModeDefinitions].canReview)
    throw new FirstSliceError(403,'original_review_mode_forbidden',`Reviews are not available in mode \`${mode}\`.`);
}
function text(value:unknown,max:number):string{originalUnitText(value,max);return value;}
function nullableText(value:unknown,max:number):string|null{return value==null?null:text(value,max);}
function storedInteger(value:unknown):string|null{
  if(value==null)return null;
  if(typeof value==='string'&&/^-?\d+$/.test(value)&&value.length<=256&&BigInt(value)>=-maximum-1n&&BigInt(value)<=maximum)return BigInt(value).toString();
  throw invalid();
}
/** Only the native JSON decoder creates this marker for an actual JSON integer.
 * A numeric string or lookalike object supplied by a client remains invalid. */
export class OriginalReviewInteger{
  readonly value:string;
  constructor(value:string){this.value=storedInteger(value)!;Object.freeze(this);}
}
function integer(value:unknown):string|null{
  if(value==null)return null;
  if(typeof value==='number'&&Number.isSafeInteger(value))return BigInt(value).toString();
  if(value instanceof OriginalReviewInteger)return value.value;
  throw invalid();
}
function priority(value:unknown):0|1|2|3{
  const numeric=typeof value==='number'?value:typeof value==='string'&&/^[\t\n\r ]*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?[\t\n\r ]*$/i.test(value)?Number(value):NaN;
  return (Number.isFinite(numeric)&&numeric>=0&&numeric<4?Math.trunc(numeric):0) as 0|1|2|3;
}
function inputFields(body:unknown,create:boolean,unit:boolean){
  if(!body||typeof body!=='object'||Array.isArray(body))throw invalid();
  const fields=body as Record<string,unknown>;
  if(fields.entry==null)throw new FirstSliceError(400,'original_review_entry_missing','Required body-parameter is missing: `entry`');
  // Keep strict bounded input. Source's untyped/omitted category path can throw
  // PHP TypeError; it must not bypass the Rewrite's typed-payload boundary.
  const categories=fields.categories??(create?undefined:'');
  return{entry:text(fields.entry,1024*1024),categories:text(categories,50),priority:priority(fields.priority??0),
    reviewer:nullableText(fields.reviewer,255),pageLabel:unit?nullableText(fields.pagelabel,255):null,
    ...(create?{userAgent:text(fields.userAgent??'',512),originalUnitId:unit?text(fields.originalUnitId??'',255):'',page:unit?integer(fields.page):null}:{})};
}
export function assertOriginalNativeReview(row:OriginalNativeReview):void{
  assertOriginalReviewScope(row);text(row.reviewId,255);if(!row.reviewId)throw invalid();
  for(const number of [row.reviewNumber,row.testNumber,row.personNumber])if(originalReviewNumber(number)!==number)throw invalid();
  if(![0,1,2,3].includes(row.priority))throw invalid();
  text(row.categories,50);text(row.entry,1024*1024);nullableText(row.reviewer,255);nullableText(row.pageLabel,255);
  text(row.userAgent,512);text(row.originalUnitId,255);if(storedInteger(row.page)!==row.page)throw invalid();
  if(row.unitName===null&&(row.page!==null||row.pageLabel!==null||row.originalUnitId!==''))throw invalid();
  for(const at of [row.createdAt,row.updatedAt])if(typeof at!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?Z$/.test(at)||!Number.isFinite(Date.parse(at)))throw invalid();
}
export function originalReviewProjection(row:OriginalNativeReview):WorkspaceReview{
  assertOriginalNativeReview(row);
  const page=row.page===null?null:Number(row.page);
  return{reviewId:row.reviewId,tenantId:row.tenantId,workspaceId:row.workspaceId,participantSessionId:row.participantSessionId,
    testRunId:row.testRunId,unitKey:row.unitName,originalUnitId:row.originalUnitId||null,
    page:page!==null&&Number.isSafeInteger(page)?page:null,pageLabel:row.pageLabel,userAgent:row.userAgent,
    reviewerId:row.reviewer??'',priority:row.priority,category:row.categories,categories:row.categories.split(' '),
    comment:row.entry,createdAt:row.createdAt,updatedAt:row.updatedAt};
}
/** Canonical edits of a known native review preserve the same immutable target
 * and provenance; only fields editable in Source may change. */
export function synchronizeOriginalReviewProjection(previous:OriginalNativeReview,review:WorkspaceReview):OriginalNativeReview{
  const before=originalReviewProjection(previous);
  for(const key of ['reviewId','tenantId','workspaceId','participantSessionId','testRunId','unitKey','originalUnitId','page','userAgent','createdAt'] as const)
    if(review[key]!==before[key])throw new FirstSliceError(409,'original_review_provenance_immutable','The native Review target and provenance cannot change.');
  const next={...previous,entry:review.comment,categories:review.category,priority:review.priority,pageLabel:review.pageLabel,
    reviewer:review.reviewerId===before.reviewerId?previous.reviewer:review.reviewerId||null,updatedAt:review.updatedAt};
  assertOriginalNativeReview(next);return next;
}
export function prepareOriginalReviewMutation(scope:OriginalReviewScope,context:OriginalReviewContext,operation:OriginalReviewMutation):OriginalReviewEffect{
  assertOriginalReviewScope(scope);requireOriginalReviewMode(context.person);
  const previous=context.previous,counter=originalReviewNumber(context.counter,true);
  if(previous){assertOriginalNativeReview(previous);if(!originalReviewScopeMatches(scope,previous))throw invalid();}
  if(previous&&BigInt(previous.reviewNumber)>BigInt(counter))throw Error('Invalid persisted native Review counter.');
  if(operation.action==='create'){
    if(previous||BigInt(counter)===maximum)throw new FirstSliceError(409,'original_review_number_exhausted','The native Review number space is unavailable.');
    const fields=inputFields(operation.body,true,scope.unitName!==null);
    const unit=scope.unitName===null?undefined:context.unit?structuredClone(context.unit):
      createOriginalUnitRecord({...scope,unitName:scope.unitName},fields.originalUnitId??'');
    if(unit){assertOriginalUnitRecord(unit);if(!originalUnitParentMatches(scope,unit)||!originalParticipantGroupKeysEqual(unit.unitName,scope.unitName!))throw invalid();}
    const review:OriginalNativeReview={...scope,reviewId:operation.reviewId,reviewNumber:(BigInt(counter)+1n).toString(),
      testNumber:originalReviewNumber(context.testNumber),personNumber:originalReviewNumber(context.personNumber),
      priority:fields.priority,categories:fields.categories,entry:fields.entry,reviewer:fields.reviewer,
      page:fields.page??null,pageLabel:fields.pageLabel,userAgent:fields.userAgent??'',originalUnitId:unit?.originalUnitId??'',
      createdAt:operation.at,updatedAt:operation.at};
    assertOriginalNativeReview(review);return{review,projection:originalReviewProjection(review),unit,counter:review.reviewNumber};
  }
  const number=originalReviewNumber(operation.reviewNumber);
  if(!previous||previous.reviewNumber!==number)throw new FirstSliceError(404,'original_review_not_found',`Review with ID ${number} not found`);
  if(operation.action==='delete')return{review:null,projection:null,counter,deletedReviewId:previous.reviewId};
  const fields=inputFields(operation.body,false,scope.unitName!==null);
  const review:OriginalNativeReview={...previous,priority:fields.priority,categories:fields.categories,entry:fields.entry,
    reviewer:fields.reviewer,pageLabel:fields.pageLabel,updatedAt:operation.at};
  assertOriginalNativeReview(review);return{review,projection:originalReviewProjection(review),counter};
}
function sqlTime(at:string,creation:boolean):string{
  const [whole,fraction]=at.replace('T',' ').replace(/Z$/,'').split('.');
  return whole+(creation?'':fraction&&fraction.replace(/0+$/,'')?'.'+fraction.replace(/0+$/,''):'')+'+00';
}
/** Source JSON fields and signed-int64 numeric tokens without a Number roundtrip. */
export function formatOriginalReviewListJson(rows:OriginalNativeReview[]):string{
  return '['+rows.map(row=>{
    assertOriginalNativeReview(row);
    const raw=(value:string)=>originalReviewNumber(value);
    const fields:Array<[string,string]>=[['id',raw(row.reviewNumber)],
      ...(row.unitName===null?[["booklet_id",raw(row.testNumber)]] as Array<[string,string]>:
        [["unit_name",encodeOriginalReportJson(row.unitName)],["test_id",raw(row.testNumber)]] as Array<[string,string]>),
      ['person_id',raw(row.personNumber)],['reviewtime',encodeOriginalReportJson(sqlTime(row.updatedAt,row.updatedAt===row.createdAt))],
      ['priority',String(row.priority)],['categories',encodeOriginalReportJson(row.categories)],['entry',encodeOriginalReportJson(row.entry)],
      ['reviewer',encodeOriginalReportJson(row.reviewer)],
      ...(row.unitName===null?[]:[['page',row.page??'null'],['pagelabel',encodeOriginalReportJson(row.pageLabel)]] as Array<[string,string]>),
      ['userAgent',encodeOriginalReportJson(row.userAgent)],
      ...(row.unitName===null?[]:[['originalUnitId',encodeOriginalReportJson(row.originalUnitId)]] as Array<[string,string]>)];
    return '{'+fields.map(([key,value])=>encodeOriginalReportJson(key)+':'+value).join(',')+'}';
  }).join(',')+']';
}
