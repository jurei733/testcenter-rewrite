import type {WorkspaceReview} from '@testcenter-rewrite-app/domain';
import type {OriginalPersonNumberRecord} from './original-person-number.js';
import type {OriginalTestNumberRecord} from './original-test-number.js';
import {selectOriginalPersonNumber} from './original-person-number.js';
import {readOriginalUnitCollection} from './original-unit-collections.js';
import {assertOriginalUnitParent,originalUnitParentMatches,originalUnitRecordKey} from './original-unit-record.js';
import {assertOriginalNativeReview,assertOriginalReviewScope,originalReviewScopeMatches,originalReviewKey,
  originalReviewNumber,originalReviewHistoryUnavailable,prepareOriginalReviewMutation,synchronizeOriginalReviewProjection,
  type OriginalNativeReview,type OriginalReviewScope,type OriginalReviewMutation} from './original-review-record.js';
import {originalParticipantGroupKeysEqual} from './original-participant-group.js';
import {assertResultArtifactParent} from './result-artifact-parent.js';

type Collection<Row>=Map<string,Row>|Record<string,Row>;
export type OriginalReviewCollections=Parameters<typeof readOriginalUnitCollection>[0]&{
  originalNativeReviews:Collection<OriginalNativeReview>;originalUnitReviewCounter:string;originalTestReviewCounter:string;
  originalTestNumbers:Collection<OriginalTestNumberRecord>;originalPersonNumbers:Collection<OriginalPersonNumberRecord>;
};
const get=<Row>(c:Collection<Row>,key:string):Row|undefined=>c instanceof Map?c.get(key):Object.hasOwn(c,key)?c[key]:undefined;
const values=<Row>(c:Collection<Row>):Row[]=>c instanceof Map?[...c.values()]:Object.values(c);
const set=<Row>(c:Collection<Row>,key:string,row:Row)=>{if(c instanceof Map)c.set(key,row);else Object.defineProperty(c,key,{value:row,enumerable:true,writable:true,configurable:true});};
const remove=<Row>(c:Collection<Row>,key:string)=>{if(c instanceof Map)c.delete(key);else delete c[key];};
export function readOriginalReviewCollection(state:OriginalReviewCollections,scope:OriginalReviewScope):OriginalNativeReview[]{
  assertOriginalReviewScope(scope);
  assertOriginalUnitParent({...scope,unitName:scope.unitName??'__booklet_review__'},get(state.testRuns,scope.testRunId),get(state.participantSessions,scope.participantSessionId));
  const rows=values(state.originalNativeReviews).filter(row=>originalReviewScopeMatches(scope,row));
  const person=get(state.participantSessions,scope.participantSessionId)!,mapping=get(state.originalTestNumbers,scope.testRunId),personMapping=get(state.originalPersonNumbers,scope.participantSessionId);
  if(!mapping||!originalUnitParentMatches(scope,mapping)||typeof person.originalLoginKey!=='string'||typeof person.originalNameSuffix!=='string')throw originalReviewHistoryUnavailable();
  const personNumber=selectOriginalPersonNumber({...person,originalLoginKey:person.originalLoginKey,originalNameSuffix:person.originalNameSuffix},personMapping,person);
  if(!personNumber)throw originalReviewHistoryUnavailable();
  for(const row of rows){assertOriginalNativeReview(row);if(row.testNumber!==mapping.testNumber||row.personNumber!==personNumber)throw originalReviewHistoryUnavailable();}
  const ids=new Set(rows.map(row=>row.reviewId));
  const legacy=values(state.workspaceReviews).some(row=>row.testRunId===scope.testRunId&&row.participantSessionId===scope.participantSessionId&&
    (scope.unitName===null?row.unitKey===null:row.unitKey!==null&&originalParticipantGroupKeysEqual(row.unitKey,scope.unitName))&&!ids.has(row.reviewId));
  if(legacy)throw originalReviewHistoryUnavailable();
  return structuredClone(rows.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));
}
export function mutateOriginalReviewCollection(state:OriginalReviewCollections,scope:OriginalReviewScope,operation:OriginalReviewMutation):OriginalNativeReview|null{
  const rows=readOriginalReviewCollection(state,scope),person=get(state.participantSessions,scope.participantSessionId)!;
  const mapping=get(state.originalTestNumbers,scope.testRunId),personMapping=get(state.originalPersonNumbers,scope.participantSessionId);
  if(!mapping||!originalUnitParentMatches(scope,mapping)||typeof person.originalLoginKey!=='string'||typeof person.originalNameSuffix!=='string')throw originalReviewHistoryUnavailable();
  const personNumber=selectOriginalPersonNumber({...person,originalLoginKey:person.originalLoginKey,originalNameSuffix:person.originalNameSuffix},personMapping,person);
  if(!personNumber)throw originalReviewHistoryUnavailable();
  const previous=operation.action==='create'?null:rows.find(row=>row.reviewNumber===originalReviewNumber(operation.reviewNumber))??null;
  const counterKey=scope.unitName===null?'originalTestReviewCounter':'originalUnitReviewCounter';
  const unit=scope.unitName===null||operation.action!=='create'?null:readOriginalUnitCollection(state,{...scope,unitName:scope.unitName});
  const effect=prepareOriginalReviewMutation(scope,{previous,unit,counter:state[counterKey],person,testNumber:mapping.testNumber,personNumber},operation);
  if(operation.action==='create'&&effect.review&&(get(state.workspaceReviews,effect.review.reviewId)||get(state.originalNativeReviews,originalReviewKey(effect.review))))throw Error('Native Review identity collision.');
  // Validate every effect before publishing Unit, Review, mirror and counter.
  if(effect.unit)set(state.originalNativeUnits,originalUnitRecordKey(effect.unit),effect.unit);
  if(effect.deletedReviewId){remove(state.workspaceReviews,effect.deletedReviewId);remove(state.originalNativeReviews,originalReviewKey(previous!));}
  if(effect.review&&effect.projection){set(state.workspaceReviews,effect.review.reviewId,effect.projection);set(state.originalNativeReviews,originalReviewKey(effect.review),effect.review);}
  state[counterKey]=effect.counter;
  return structuredClone(effect.review);
}
export function validateOriginalReviewCollections(state:OriginalReviewCollections):void{
  for(const key of ['originalUnitReviewCounter','originalTestReviewCounter'] as const)originalReviewNumber(state[key],true);
  const seen=new Set<string>();
  for(const [key,row]of state.originalNativeReviews instanceof Map?state.originalNativeReviews.entries():Object.entries(state.originalNativeReviews)){
    assertOriginalNativeReview(row);const counter=row.unitName===null?state.originalTestReviewCounter:state.originalUnitReviewCounter;
    if(key!==originalReviewKey(row)||seen.has(row.reviewId)||BigInt(row.reviewNumber)>BigInt(counter)||!get(state.workspaceReviews,row.reviewId))throw Error('Invalid native Review identity metadata.');
    seen.add(row.reviewId);
  }
}
export function readOriginalReviewPersonCollection(state:OriginalReviewCollections,scope:{participantSessionId:string;tenantId:string;workspaceId:string}):OriginalNativeReview[]{
  assertResultArtifactParent(scope,get(state.participantSessions,scope.participantSessionId));
  const rows=values(state.originalNativeReviews).filter(row=>row.participantSessionId===scope.participantSessionId&&row.tenantId===scope.tenantId&&row.workspaceId===scope.workspaceId);
  const known=new Set(rows.map(row=>row.reviewId));
  if(values(state.workspaceReviews).some(row=>row.participantSessionId===scope.participantSessionId&&!known.has(row.reviewId)))throw originalReviewHistoryUnavailable();
  for(const row of rows)readOriginalReviewCollection(state,row);
  return structuredClone(rows);
}
export function synchronizeOriginalReviewCollection(state:Pick<OriginalReviewCollections,'originalNativeReviews'>,review:WorkspaceReview):void{
  const entries=[...(state.originalNativeReviews instanceof Map?state.originalNativeReviews.entries():Object.entries(state.originalNativeReviews))].filter(([,row])=>row.reviewId===review.reviewId);
  if(entries.length>1)throw Error('Native Review identity collision.');
  const entry=entries[0];if(entry)set(state.originalNativeReviews,entry[0],synchronizeOriginalReviewProjection(entry[1],review));
}
export function deleteOriginalReviewCollection(state:Pick<OriginalReviewCollections,'originalNativeReviews'>,predicate:(review:OriginalNativeReview)=>boolean):void{
  for(const [key,row]of state.originalNativeReviews instanceof Map?state.originalNativeReviews.entries():Object.entries(state.originalNativeReviews))if(predicate(row))remove(state.originalNativeReviews,key);
}
