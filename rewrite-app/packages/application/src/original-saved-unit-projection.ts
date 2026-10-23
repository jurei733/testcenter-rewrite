import type { TestRun, WorkspaceActivityEvent, WorkspaceReview } from '@testcenter-rewrite-app/domain';

export const originalReviewUnitEventTypes = ['review_created', 'review_updated', 'review_deleted'] as const;

/** Source persists a Unit before its first review, independently of answers.
 * The durable review journal keeps that identity after the comment is deleted.
 * Arbitrary Unit-scoped logs do not establish a saved Unit. */
export function selectOriginalSavedUnitKeys(input: {
  testRuns: TestRun[];
  reviews: WorkspaceReview[];
  activityEvents: WorkspaceActivityEvent[];
}): Map<string, Set<string>> {
  const runs = new Map(input.testRuns.map(run => [run.testRunId, run]));
  const units = new Map(input.testRuns.map(run => [run.testRunId, new Set(Object.keys(run.unitResponses ?? {}))]));
  const reviewEvents: ReadonlySet<string> = new Set(originalReviewUnitEventTypes);
  const add = (run: TestRun | undefined, evidence: {tenantId: string; workspaceId: string},
    participantSessionId: unknown, unitKey: unknown): void => {
    if (run && evidence.tenantId === run.tenantId && evidence.workspaceId === run.workspaceId &&
      participantSessionId === run.participantSessionId && typeof unitKey === 'string' && unitKey.trim()) {
      units.get(run.testRunId)!.add(unitKey);
    }
  };
  for (const review of input.reviews) {
    add(runs.get(review.testRunId), review, review.participantSessionId, review.unitKey);
  }
  for (const event of input.activityEvents) {
    if (!reviewEvents.has(event.eventType) || event.subjectType !== 'test_run' ||
      typeof event.details?.reviewId !== 'string' || !event.details.reviewId.trim() ||
      !Number.isFinite(Date.parse(event.occurredAt))) continue;
    add(runs.get(event.subjectId), event, event.details.participantSessionId, event.details.unitKey);
  }
  return units;
}
