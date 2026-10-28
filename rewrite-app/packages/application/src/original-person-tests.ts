import type {ParticipantSession,TestRun} from '@testcenter-rewrite-app/domain';
import {assertOriginalTestCreationCandidate} from './original-test-number.js';
import {bindOriginalPersonContentForFirstTest,prepareParticipantAssignmentRunCreation} from './participant-assignment-runs.js';
import {originalParticipantGroupKeysEqual} from './original-participant-group.js';
import {FirstSliceError} from './first-slice-error.js';
export type OriginalPersonTestIdentity = Pick<TestRun,'testRunId'|'participantSessionId'|'tenantId'|'workspaceId'|'contentReleaseId'|'bookletKey'|'bookletAssignmentKey'|'locked'> & {
  originalResultState?:Pick<NonNullable<TestRun['originalResultState']>,'bookletName'|'bookletLabel'>;
};
export type OriginalPersonTestScope = Pick<ParticipantSession,'participantSessionId'|'tenantId'|'workspaceId'>;
/** Native Test lookup must not decode controller or response payloads. */
export function projectOriginalPersonTestIdentity(run:OriginalPersonTestIdentity):OriginalPersonTestIdentity {
  return {testRunId:run.testRunId,participantSessionId:run.participantSessionId,tenantId:run.tenantId,workspaceId:run.workspaceId,contentReleaseId:run.contentReleaseId,
    bookletKey:run.bookletKey,...(run.bookletAssignmentKey===undefined?{}:{bookletAssignmentKey:run.bookletAssignmentKey}),locked:run.locked===true,
    ...(run.originalResultState===undefined?{}:{originalResultState:{bookletName:run.originalResultState.bookletName,bookletLabel:run.originalResultState.bookletLabel}})};
}


export type OriginalPersonTestReservation = {testRun:OriginalPersonTestIdentity;created:boolean;originalTestNumber:string};
/** The monitor's reservation sees identity metadata only, including when a
 * participant won creation concurrently or already has other private Tests. */
export function prepareOriginalPersonTestCreation(candidate:TestRun,session:ParticipantSession|null,runs:OriginalPersonTestIdentity[],
  release?:import('./participant-assignment-runs.js').ParticipantInitialContentRelease|null):{
    testRun:OriginalPersonTestIdentity;fresh?:TestRun;participantSession?:ParticipantSession;created:boolean;
  } {
  assertOriginalTestCreationCandidate(candidate);
  if(!session||session.originalLoginKey===undefined||session.originalNameSuffix===undefined)throw new Error('A native Test requires its known parent identity.');
  const parent=bindOriginalPersonContentForFirstTest(candidate,session,runs,release);
  if(!parent||parent.participantSessionId!==candidate.participantSessionId||parent.tenantId!==candidate.tenantId||parent.workspaceId!==candidate.workspaceId||parent.contentReleaseId!==candidate.contentReleaseId)throw new Error('Participant session scope does not match the native reservation.');
  const name=candidate.originalResultState?.bookletName;
  const matches=(run:OriginalPersonTestIdentity)=>run.participantSessionId===candidate.participantSessionId&&run.tenantId===candidate.tenantId&&run.workspaceId===candidate.workspaceId&&run.contentReleaseId===candidate.contentReleaseId&&typeof name==='string'&&originalParticipantGroupKeysEqual(run.originalResultState?.bookletName??run.bookletAssignmentKey??run.bookletKey,name);
  if(runs.some(run=>run.testRunId===candidate.testRunId&&!matches(run)))throw new Error('Run ID already exists outside the native reservation.');
  const existing=runs.filter(matches);
  if(existing.length>1)throw new FirstSliceError(409,'original_test_history_ambiguous','Native Test history contains ambiguous assignment identities.');
  if(existing[0]){
    if(typeof existing[0].originalResultState?.bookletName!=='string'||typeof existing[0].originalResultState.bookletLabel!=='string')throw new FirstSliceError(409,'original_test_history_unknown','The Original Test identity is unavailable.');
    return{testRun:projectOriginalPersonTestIdentity(existing[0]),created:false};
  }
  const prepared=prepareParticipantAssignmentRunCreation(candidate,parent,[]);
  return{testRun:projectOriginalPersonTestIdentity(prepared.testRun),fresh:prepared.testRun,created:true,
    ...(session.contentReleaseId===null?{participantSession:parent}:{})};
}
