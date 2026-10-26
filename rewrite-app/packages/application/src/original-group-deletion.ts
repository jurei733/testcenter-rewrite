import type {OriginalNativeUnit} from '@testcenter-rewrite-app/domain';
import type {OriginalTestNumberRecord} from './original-test-number.js';
import type {AttachmentFile, OriginalLoginBinding, OriginalParticipantGroup, ParticipantSession, TestRun, WorkspaceActivityEvent, WorkspaceReview, ParticipantTestLog, ParticipantRunCommand, ParticipantProgressDelivery} from '@testcenter-rewrite-app/domain';
import type {OriginalSessionToken} from './original-session-token.js';
import {FirstSliceError} from './first-slice-error.js';
import {compareOriginalParticipantGroupKeys} from './original-participant-group.js';

export type OriginalGroupDeletionInput = {tenantId: string; workspaceId: string; groups: string[]};
export type OriginalGroupDeletionResult = {deletedGroupCount: number; deletedLoginCount: number; deletedPersonCount: number;
  deletedTestCount: number; deletedReviewCount: number; deletedLogCount: number; deletedAttachmentFileCount: number};
export function prepareOriginalGroupSelection(groups: unknown): string[] {
  if (!Array.isArray(groups) || groups.some(group => typeof group !== 'string')) throw new FirstSliceError(400, 'original_result_groups_invalid', 'Group names must be strings.');
  return [...groups];
}
export const prepareOriginalGroupDeletionInput = (input: OriginalGroupDeletionInput): OriginalGroupDeletionInput => {
  if (![input.tenantId, input.workspaceId].every(value => typeof value === 'string' && value.length > 0)) throw new TypeError('A native group deletion requires its workspace scope.');
  return {tenantId: input.tenantId, workspaceId: input.workspaceId, groups: prepareOriginalGroupSelection(input.groups)};
};
export function selectOriginalGroupDeletionKeys(input: OriginalGroupDeletionInput, groups: Array<Pick<OriginalParticipantGroup, 'groupKey'>>): string[] {
  const selected = [...new Set(input.groups)].sort(compareOriginalParticipantGroupKeys);
  return groups.filter(group => {
    let low=0, high=selected.length-1;
    while(low<=high) {const middle=(low+high)>>>1, comparison=compareOriginalParticipantGroupKeys(selected[middle]!,group.groupKey);
      if(comparison===0)return true; if(comparison<0)low=middle+1;else high=middle-1;}
    return false;
  }).map(group=>group.groupKey);
}

/** Existing attachment identities encode the exact Run/Unit/variable tuple. */
export function attachmentTestRunId(attachmentId: string): string | null {
  if (!/^att-[A-Za-z0-9_-]+$/.test(attachmentId)) return null;
  try {
    const encoded = attachmentId.slice(4), bytes = Buffer.from(encoded, 'base64url');
    if (bytes.toString('base64url') !== encoded) return null;
    const tuple: unknown = JSON.parse(bytes.toString('utf8'));
    return Array.isArray(tuple) && tuple.length === 3 && tuple.every(value => typeof value === 'string') && tuple[0].length > 0 ? tuple[0] as string : null;
  } catch {return null;}
}

type Collection<Row> = Map<string, Row> | Record<string, Row>;
const values = <Row>(collection: Collection<Row>): Row[] => collection instanceof Map ? [...collection.values()] : Object.values(collection);
const remove = <Row>(collection: Collection<Row>, predicate: (row: Row, key: string) => boolean): number => {
  let count = 0;
  for (const [key, row] of collection instanceof Map ? collection.entries() : Object.entries(collection)) if (predicate(row, key)) {
    if (collection instanceof Map) collection.delete(key); else delete collection[key]; count++;
  }
  return count;
};
export type OriginalGroupDeletionCollections = {
  originalParticipantGroups: Collection<OriginalParticipantGroup>; originalLoginBindings: Collection<OriginalLoginBinding>;
  originalSessionTokens: Collection<OriginalSessionToken>; participantSessions: Collection<ParticipantSession>;
  originalTestRunsByNumber?: Collection<string>;
  originalTestNumbers?: Collection<OriginalTestNumberRecord>;
  originalNativeUnits?:Collection<OriginalNativeUnit>;
  participantAccessCredentials: Collection<{participantSessionId: string}>; testRuns: Collection<TestRun>;
  workspaceReviews: Collection<WorkspaceReview>; participantTestLogs: Collection<ParticipantTestLog>;
  participantRunCommands: Collection<ParticipantRunCommand>; participantProgressDeliveries: Collection<ParticipantProgressDelivery>;
  participantPresence: Collection<{testRunId: string}>; workspaceActivityEvents: Collection<WorkspaceActivityEvent>; attachmentFiles: Collection<AttachmentFile>;
};
/** One synchronous mutation of owned collections. File publishes it only after
 * the durable manifest commits; no response or attachment payload is inspected. */
export function deleteOriginalGroupsFromCollections(state: OriginalGroupDeletionCollections, input: OriginalGroupDeletionInput): OriginalGroupDeletionResult {
  const scoped = (row: {tenantId: string; workspaceId: string}) => row.tenantId === input.tenantId && row.workspaceId === input.workspaceId;
  const groups = new Set(selectOriginalGroupDeletionKeys(input, values(state.originalParticipantGroups).filter(scoped)));
  const bindings = values(state.originalLoginBindings).filter(row => scoped(row) && groups.has(row.groupSnapshotKey));
  const logins = new Set(bindings.map(row => row.loginKey));
  const people = new Set(values(state.participantSessions).filter(row => scoped(row) && typeof row.originalLoginKey === 'string' && logins.has(row.originalLoginKey)).map(row => row.participantSessionId));
  const runs = new Set(values(state.testRuns).filter(row => scoped(row) && people.has(row.participantSessionId)).map(row => row.testRunId));
  const descendant = (row: {tenantId: string; workspaceId: string; participantSessionId: string; testRunId: string}) => scoped(row) && (people.has(row.participantSessionId) || runs.has(row.testRunId));
  const reviews = new Set(values(state.workspaceReviews).filter(descendant).map(row => row.reviewId));
  const deletedAttachmentFileCount = remove(state.attachmentFiles, row => scoped(row) && runs.has(attachmentTestRunId(row.attachmentId) ?? ''));
  const deletedReviewCount = remove(state.workspaceReviews, descendant), deletedLogCount = remove(state.participantTestLogs, descendant);
  remove(state.workspaceActivityEvents, row => scoped(row) && (
    row.subjectType === 'participant_session' && people.has(row.subjectId) || row.subjectType === 'test_run' && runs.has(row.subjectId) ||
    typeof row.details.participantSessionId === 'string' && people.has(row.details.participantSessionId) ||
    typeof row.details.testRunId === 'string' && runs.has(row.details.testRunId) ||
    typeof row.details.reviewId === 'string' && reviews.has(row.details.reviewId)));
  remove(state.participantRunCommands, descendant); remove(state.participantProgressDeliveries, descendant);
  if(state.originalNativeUnits)remove(state.originalNativeUnits,descendant);
  if (state.originalTestNumbers) remove(state.originalTestNumbers, descendant);
  if(state.originalTestRunsByNumber)remove(state.originalTestRunsByNumber,id=>runs.has(id));
  remove(state.participantPresence, row => runs.has(row.testRunId));
  remove(state.participantAccessCredentials, row => people.has(row.participantSessionId));
  const deletedTestCount = remove(state.testRuns, row => scoped(row) && runs.has(row.testRunId));
  const deletedPersonCount = remove(state.participantSessions, row => scoped(row) && people.has(row.participantSessionId));
  remove(state.originalSessionTokens, row => scoped(row) && (row.kind === 'group' ? groups.has(row.subjectKey) : logins.has(row.subjectKey)));
  const deletedLoginCount = remove(state.originalLoginBindings, row => scoped(row) && logins.has(row.loginKey));
  const deletedGroupCount = remove(state.originalParticipantGroups, row => scoped(row) && groups.has(row.groupKey));
  return {deletedGroupCount, deletedLoginCount, deletedPersonCount, deletedTestCount, deletedReviewCount, deletedLogCount, deletedAttachmentFileCount};
}
