import type {Pool} from 'pg';
import {assertOriginalTestLogInput, prepareOriginalTestLock, resultParentUnavailable, type OriginalTestNumberRecord} from '@testcenter-rewrite-app/application';
import {withResultArtifactParent} from './result-artifact-parent.js';

export async function lockOriginalTest(pool: Pool, input: OriginalTestNumberRecord, timestamp: string): Promise<void> {
  assertOriginalTestLogInput(input);
  await withResultArtifactParent(pool, input, async client => {
    const result = await client.query(`SELECT t.original_result_state_json FROM original_test_numbers m
      JOIN test_runs t ON t.test_run_id=m.test_run_id AND t.participant_session_id=m.participant_session_id AND t.tenant_id=m.tenant_id AND t.workspace_id=m.workspace_id AND t.content_release_id=m.content_release_id
      JOIN participant_sessions p ON p.participant_session_id=m.participant_session_id AND p.tenant_id=m.tenant_id AND p.workspace_id=m.workspace_id AND p.content_release_id=m.content_release_id
      WHERE m.test_number=$1 AND m.test_run_id=$2 AND m.participant_session_id=$3 AND m.tenant_id=$4 AND m.workspace_id=$5 AND m.content_release_id=$6
      AND p.original_login_key IS NOT NULL AND p.original_name_suffix IS NOT NULL`, [input.testNumber, input.testRunId, input.participantSessionId, input.tenantId, input.workspaceId, input.contentReleaseId]);
    if (!result.rowCount) throw resultParentUnavailable();
    const before = result.rows[0].original_result_state_json;
    const effect = prepareOriginalTestLock(timestamp, typeof before === 'string' ? JSON.parse(before) : before ?? undefined);
    await client.query('UPDATE test_runs SET locked=TRUE, updated_at=$1, original_result_state_json=$2::jsonb WHERE test_run_id=$3',
      [effect.updatedAt, JSON.stringify(effect.originalResultState), input.testRunId]);
  }, true);
}
