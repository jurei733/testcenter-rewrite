import {createHash} from 'node:crypto';
import type {ContentRelease, ParticipantSession, TestRun, WorkspaceActivityEvent} from '@testcenter-rewrite-app/domain';

export type ContentReleaseActivationState = {
  contentReleases: ContentRelease[];
  participantSessions: ParticipantSession[];
  testRuns: TestRun[];
};
export type ContentReleaseActivationCommit = {
  tenantId: string;
  workspaceId: string;
  contentReleaseId: string;
  activatedAt: string;
  expectedRevision: string;
  activityEvent: WorkspaceActivityEvent;
};

// JSONB key order and durable collection ordering must not change a revision.
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, item]) => [key, canonical(item)])
  );
  return value;
};
export function createContentReleaseActivationRevision(state: ContentReleaseActivationState): string {
  const rows = (values: object[]) => values.map(value => JSON.stringify(canonical(value))).sort();
  return 'sha256:' + createHash('sha256').update(JSON.stringify({
    contentReleases: rows(state.contentReleases),
    participantSessions: rows(state.participantSessions),
    // Answer autosaves and clock updates do not affect the open-run decision.
    // They must remain writable without starving an operator activation.
    testRuns: rows(state.testRuns.map(run => ({
      testRunId: run.testRunId, participantSessionId: run.participantSessionId,
      tenantId: run.tenantId, workspaceId: run.workspaceId,
      contentReleaseId: run.contentReleaseId, bookletKey: run.bookletKey,
      executionMode: run.executionMode, status: run.status
    })))
  })).digest('hex');
}

/** Called under the store write boundary. Never accept a caller-authored
 * replacement runtime snapshot, or partially mutate Memory before cloning. */
export function prepareContentReleaseActivation(input: ContentReleaseActivationCommit,
  state: ContentReleaseActivationState & {workspaceExists: boolean; eventIdAvailable: boolean}
): {contentReleases: ContentRelease[]; activityEvent: WorkspaceActivityEvent} | null {
  const scoped = (value: {tenantId: string; workspaceId: string}) =>
    value.tenantId === input.tenantId && value.workspaceId === input.workspaceId;
  const target = state.contentReleases.find(value => value.contentReleaseId === input.contentReleaseId);
  const active = state.contentReleases.filter(value => value.status === 'active');
  const event = input.activityEvent;
  if (!state.workspaceExists || !state.eventIdAvailable || !target || !scoped(target) ||
    !Number.isFinite(Date.parse(input.activatedAt)) || !event.activityEventId || !scoped(event) ||
    (event.actorId !== null && typeof event.actorId !== 'string') ||
    event.eventType !== 'content_release_activated' || event.subjectType !== 'content_release' ||
    event.subjectId !== target.contentReleaseId || event.occurredAt !== input.activatedAt ||
    (active.length ? !active.some(release => release.contentReleaseId === event.details.previousActiveContentReleaseId)
      : event.details.previousActiveContentReleaseId !== null) ||
    createContentReleaseActivationRevision(state) !== input.expectedRevision) return null;
  return structuredClone({
    contentReleases: state.contentReleases.flatMap<ContentRelease>(release => release.contentReleaseId === target.contentReleaseId
      ? [{...release, status: 'active' as const, activatedAt: input.activatedAt}]
      : release.status === 'active' ? [{...release, status: 'superseded' as const}] : []),
    activityEvent: event
  });
}
