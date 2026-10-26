import type {OriginalNativeUnit,ParticipantSession,ParticipantTestLog,TestRun,WorkspaceReview,WorkspaceActivityEvent} from '@testcenter-rewrite-app/domain';
import {assertOriginalUnitParent,assertOriginalUnitRecord,originalUnitParentMatches,originalUnitRecordKey,selectOriginalUnitName,prepareOriginalUnitMutation,originalUnitHistoryUnavailable,type OriginalUnitInput,type OriginalUnitTransform} from './original-unit-record.js';
import {selectOriginalSavedUnitKeys} from './original-saved-unit-projection.js';
import {originalParticipantGroupKeysEqual} from './original-participant-group.js';
type Collection<Row>=Map<string,Row>|Record<string,Row>;
type State={originalNativeUnits:Collection<OriginalNativeUnit>;testRuns:Collection<TestRun>;participantSessions:Collection<ParticipantSession>;participantTestLogs:Collection<ParticipantTestLog>;workspaceReviews:Collection<WorkspaceReview>;workspaceActivityEvents:Collection<WorkspaceActivityEvent>};
const get=<Row>(collection:Collection<Row>,key:string):Row|undefined=>collection instanceof Map?collection.get(key):Object.hasOwn(collection,key)?collection[key]:undefined;
const set=<Row>(collection:Collection<Row>,key:string,row:Row):void=>{if(collection instanceof Map)collection.set(key,row);else collection[key]=row;};
const values=<Row>(collection:Collection<Row>):Row[]=>collection instanceof Map?[...collection.values()]:Object.values(collection);
export function readOriginalUnitCollection(state:State,input:OriginalUnitInput):OriginalNativeUnit|null{
 assertOriginalUnitParent(input,get(state.testRuns,input.testRunId),get(state.participantSessions,input.participantSessionId));
 const rows=values(state.originalNativeUnits).filter(row=>originalUnitParentMatches(input,row)),name=selectOriginalUnitName(input,rows.map(row=>row.unitName));
 const row=name===null?null:rows.find(row=>row.unitName===name)!;
 if(row)assertOriginalUnitRecord(row);
 else{const run=get(state.testRuns,input.testRunId)!,legacy=selectOriginalSavedUnitKeys({testRuns:[run],reviews:values(state.workspaceReviews),activityEvents:values(state.workspaceActivityEvents)}).get(input.testRunId);
  if([...legacy??[]].some(key=>originalParticipantGroupKeysEqual(key,input.unitName)))throw originalUnitHistoryUnavailable();}
 return structuredClone(row);
}
/** Generic canonical projections cannot silently masquerade as native history. */
export function invalidateOriginalUnitCollection(state:Pick<State,'originalNativeUnits'>,previous:TestRun|undefined,next:TestRun):void{
 if(!previous)return;
 for(const[key,unit]of state.originalNativeUnits instanceof Map?state.originalNativeUnits.entries():Object.entries(state.originalNativeUnits)){
  if(!originalUnitParentMatches(next,unit))continue;
  const aliases=new Set([...Object.keys(previous.unitResponses),...Object.keys(next.unitResponses)]);
  if([...aliases].some(alias=>originalParticipantGroupKeysEqual(alias,unit.unitName)&&previous.unitResponses[alias]!==next.unitResponses[alias]))set(state.originalNativeUnits,key,{...unit,unknownHistory:true});
 }
}
export function mutateOriginalUnitCollection(state:State,input:OriginalUnitInput,transform:OriginalUnitTransform):OriginalNativeUnit|null{
 const previous=readOriginalUnitCollection(state,input),effect=prepareOriginalUnitMutation(input,previous,transform);
 if(effect.logs.some(row=>get(state.participantTestLogs,row.participantTestLogId)))throw Error('Native Unit log identity collision.');
 // All validation happens before publishing either state or logs.
 if(effect.unit)set(state.originalNativeUnits,originalUnitRecordKey(effect.unit),effect.unit);
 for(const log of effect.logs)set(state.participantTestLogs,log.participantTestLogId,log);
 return structuredClone(effect.unit??previous);
}
