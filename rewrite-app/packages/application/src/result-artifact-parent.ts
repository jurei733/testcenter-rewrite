import type {ParticipantSession, TestRun, WorkspaceActivityEvent, AttachmentFile} from '@testcenter-rewrite-app/domain';
import {FirstSliceError} from './first-slice-error.js';
import {attachmentTestRunId} from './original-group-deletion.js';
export type ResultArtifactParent = {tenantId?: string; workspaceId?: string; participantSessionId?: string; testRunId?: string};
type Person = Pick<ParticipantSession, 'participantSessionId' | 'tenantId' | 'workspaceId'>;
type Run = Pick<TestRun, 'testRunId' | 'participantSessionId' | 'tenantId' | 'workspaceId'>;
export const resultParentUnavailable = (): FirstSliceError => new FirstSliceError(409, 'result_parent_scope_changed', 'The result parent is no longer available in this scope.');
export function assertResultArtifactParent(input: ResultArtifactParent, person: Person | null | undefined, run?: Run | null): void {
  if (!person || input.participantSessionId !== undefined && person.participantSessionId !== input.participantSessionId ||
    input.tenantId !== undefined && person.tenantId !== input.tenantId || input.workspaceId !== undefined && person.workspaceId !== input.workspaceId) throw resultParentUnavailable();
  if (input.testRunId !== undefined && (!run || run.testRunId !== input.testRunId || run.participantSessionId !== person.participantSessionId || run.tenantId !== person.tenantId || run.workspaceId !== person.workspaceId)) throw resultParentUnavailable();
}
export function activityResultParent(event: WorkspaceActivityEvent): ResultArtifactParent | null {
  const scope = {tenantId: event.tenantId, workspaceId: event.workspaceId};
  return event.subjectType === 'test_run' ? {...scope, testRunId: event.subjectId}
    : event.subjectType === 'participant_session' ? {...scope, participantSessionId: event.subjectId} : null;
}
export function attachmentResultParent(file: AttachmentFile): ResultArtifactParent | null {
  const testRunId = attachmentTestRunId(file.attachmentId);
  return testRunId === null ? null : {tenantId: file.tenantId, workspaceId: file.workspaceId, testRunId};
}
type Collection<Row> = Map<string, Row> | Record<string, Row>;
const get = <Row>(collection: Collection<Row>, id: string): Row | undefined => collection instanceof Map ? collection.get(id) : collection[id];
export function guardResultArtifactCollections(state: {participantSessions: Collection<Person>; testRuns: Collection<Run>}, input: ResultArtifactParent | null): void {
  if (!input) return;
  const run = input.testRunId === undefined ? undefined : get(state.testRuns, input.testRunId);
  const personId = input.participantSessionId ?? run?.participantSessionId;
  assertResultArtifactParent(input, personId === undefined ? undefined : get(state.participantSessions, personId), run);
}
