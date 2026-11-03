import type {OriginalWorkspaceWriteAuthority} from './original-workspace-write.js';
import type {OriginalGroupDeletionCollections} from './original-group-deletion.js';
import type {OriginalTestAdministrationInventory} from './original-test-administration.js';
import {readOriginalTestAdministrationCollections} from './original-test-administration.js';
import {attachmentTestRunId} from './original-group-deletion.js';
import {originalParticipantGroupKeysEqual} from './original-participant-group.js';
import {FirstSliceError} from './first-slice-error.js';

export type OriginalTestSelection = {loginName:string; code:string; nameSuffix:string; bookletName:string};
export type OriginalTestDeletionInput = {tenantId:string; workspaceId:string; personSessions:OriginalTestSelection[];authority?:OriginalWorkspaceWriteAuthority};
export type OriginalTestDeletionResult = {deletedTestCount:number; deletedReviewCount:number; deletedLogCount:number; deletedAttachmentFileCount:number};
const invalid = () => new FirstSliceError(400,'original_test_selection_invalid','personSessions must be a non-empty array of Test selections with Login and Booklet names.');
const unknown = () => new FirstSliceError(409,'original_test_administration_history_unknown','The native Test administration history is unavailable or ambiguous.');

/** No Test PUT name normalization or trimming: these are stored identities. */
export function prepareOriginalTestSelection(value:unknown):OriginalTestSelection[] {
  if(!Array.isArray(value)||!value.length)throw invalid();
  return value.map(row=>{
    if(!row||typeof row!=='object'||Array.isArray(row)||typeof row.loginName!=='string'||typeof row.bookletName!=='string')throw invalid();
    const code=row.code??'',nameSuffix=row.nameSuffix??'';
    if(typeof code!=='string'||typeof nameSuffix!=='string')throw invalid();
    return {loginName:row.loginName,code,nameSuffix,bookletName:row.bookletName};
  });
}
export function prepareOriginalTestDeletionInput(input:OriginalTestDeletionInput):OriginalTestDeletionInput {
  if(![input.tenantId,input.workspaceId].every(value=>typeof value==='string'&&value.length))throw new TypeError('Native Test deletion requires workspace scope.');
  return {tenantId:input.tenantId,workspaceId:input.workspaceId,personSessions:prepareOriginalTestSelection(input.personSessions),...(input.authority?{authority:{...input.authority}}:{})};
}

/** Includes empty/unopened Tests. Listing's saved-state predicate is irrelevant. */
export function selectOriginalTestDeletion(input:OriginalTestDeletionInput,inventory:OriginalTestAdministrationInventory):{testRunIds:string[];groupKeys:string[]} {
  const scoped=(row:{tenantId:string;workspaceId:string})=>row.tenantId===input.tenantId&&row.workspaceId===input.workspaceId;
  const people=new Map<string,OriginalTestAdministrationInventory['people'][number]>();
  for(const person of inventory.people.filter(scoped)) {
    if(typeof person.originalLoginKey!=='string'||!input.personSessions.some(row=>row.loginName===person.originalLoginKey))continue;
    if(people.has(person.participantSessionId))throw unknown();people.set(person.participantSessionId,person);
  }
  const runs=new Set<string>(),groups=new Set<string>();
  for(const run of inventory.runs.filter(scoped)) {
    const person=people.get(run.participantSessionId);if(!person)continue;
    if((typeof person.participantCode!=='string'&&person.participantCode!==null)||typeof person.originalNameSuffix!=='string')throw unknown();
    const selections=input.personSessions.filter(row=>row.loginName===person.originalLoginKey&&originalParticipantGroupKeysEqual(row.code,person.participantCode??'')&&originalParticipantGroupKeysEqual(row.nameSuffix,person.originalNameSuffix!));
    if(!selections.length)continue;
    if(typeof run.bookletName!=='string'||person.contentReleaseId!==run.contentReleaseId)throw unknown();
    if(!selections.some(row=>originalParticipantGroupKeysEqual(row.bookletName,run.bookletName!)))continue;
    const bindings=inventory.bindings.filter(row=>scoped(row)&&row.loginKey===person.originalLoginKey);
    if(bindings.length!==1)throw unknown();const binding=bindings[0]!;
    const snapshots=inventory.groups.filter(row=>scoped(row)&&row.groupKey===binding.groupSnapshotKey);
    if(snapshots.length!==1||!originalParticipantGroupKeysEqual(binding.groupKey,person.groupKey)||!originalParticipantGroupKeysEqual(binding.groupKey,snapshots[0]!.groupKey))throw unknown();
    runs.add(run.testRunId);groups.add(snapshots[0]!.groupKey);
  }
  return {testRunIds:[...runs],groupKeys:[...groups]};
}

type Collection<Row> = Map<string,Row>|Record<string,Row>;
const values=<Row>(rows:Collection<Row>):Row[]=>rows instanceof Map?[...rows.values()]:Object.values(rows);
function remove<Row>(rows:Collection<Row>,selected:(row:Row)=>boolean):number {
  let count=0;for(const [key,row]of rows instanceof Map?rows.entries():Object.entries(rows))if(selected(row)){if(rows instanceof Map)rows.delete(key);else delete rows[key];count++;}return count;
}
/** All selection validation precedes the synchronous owned-state mutation. */
export function deleteOriginalSelectedTestsFromCollections(state:OriginalGroupDeletionCollections,input:OriginalTestDeletionInput):OriginalTestDeletionResult {
  const selection=selectOriginalTestDeletion(input,readOriginalTestAdministrationCollections({...state,originalTestNumbers:state.originalTestNumbers??new Map()},input)),runs=new Set(selection.testRunIds);
  const scoped=(row:{tenantId:string;workspaceId:string})=>row.tenantId===input.tenantId&&row.workspaceId===input.workspaceId;
  const descendant=(row:{tenantId:string;workspaceId:string;testRunId:string})=>scoped(row)&&runs.has(row.testRunId);
  const reviews=new Set(values(state.workspaceReviews).filter(descendant).map(row=>row.reviewId));
  const deletedAttachmentFileCount=remove(state.attachmentFiles,row=>scoped(row)&&runs.has(attachmentTestRunId(row.attachmentId)??''));
  remove(state.workspaceActivityEvents,row=>scoped(row)&&(row.subjectType==='test_run'&&runs.has(row.subjectId)||typeof row.details.testRunId==='string'&&runs.has(row.details.testRunId)||typeof row.details.reviewId==='string'&&reviews.has(row.details.reviewId)));
  const deletedReviewCount=remove(state.workspaceReviews,descendant),deletedLogCount=remove(state.participantTestLogs,descendant);
  remove(state.participantRunCommands,descendant);remove(state.participantProgressDeliveries,descendant);remove(state.participantPresence,row=>runs.has(row.testRunId));
  if(state.originalNativeUnits)remove(state.originalNativeUnits,descendant);
  if(state.originalNativeReviews)remove(state.originalNativeReviews,descendant);
  if(state.originalNativeCommands)remove(state.originalNativeCommands,descendant);
  if(state.originalTestNumbers)remove(state.originalTestNumbers,descendant);
  if(state.originalTestRunsByNumber)remove(state.originalTestRunsByNumber,id=>runs.has(id));
  const deletedTestCount=remove(state.testRuns,descendant);
  // Source touches only affected groups, after deleting; never rotate capabilities.
  const timestamp=new Date().toISOString(),groups=new Set(selection.groupKeys);
  for(const [key,row]of state.originalParticipantGroups instanceof Map?state.originalParticipantGroups.entries():Object.entries(state.originalParticipantGroups))if(scoped(row)&&groups.has(row.groupKey)){
    const next={...row,lastModifiedAt:timestamp};if(state.originalParticipantGroups instanceof Map)state.originalParticipantGroups.set(key,next);else Object.defineProperty(state.originalParticipantGroups,key,{value:next,writable:true,enumerable:true,configurable:true});
  }
  return {deletedTestCount,deletedReviewCount,deletedLogCount,deletedAttachmentFileCount};
}
