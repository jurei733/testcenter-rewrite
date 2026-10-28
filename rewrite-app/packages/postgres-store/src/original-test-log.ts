import {exactParticipantTestLogTimestamp} from '@testcenter-rewrite-app/domain';
import {assertOriginalTestLogInput, prepareOriginalTestLogs, resultParentUnavailable, type OriginalTestNumberRecord} from '@testcenter-rewrite-app/application';
import type {ParticipantTestLog} from '@testcenter-rewrite-app/domain';
import type {Pool} from 'pg';
import {withResultArtifactParent} from './result-artifact-parent.js';

export async function appendOriginalTestLogs(pool: Pool, input: OriginalTestNumberRecord, logs: ParticipantTestLog[]): Promise<void> {
  assertOriginalTestLogInput(input);
  await withResultArtifactParent(pool, input, async client => {
    const parent = await client.query(`SELECT 1 FROM original_test_numbers m
      JOIN test_runs t ON t.test_run_id=m.test_run_id AND t.participant_session_id=m.participant_session_id AND t.tenant_id=m.tenant_id AND t.workspace_id=m.workspace_id AND t.content_release_id=m.content_release_id
      JOIN participant_sessions p ON p.participant_session_id=m.participant_session_id AND p.tenant_id=m.tenant_id AND p.workspace_id=m.workspace_id AND p.content_release_id=m.content_release_id
      WHERE m.test_number=$1 AND m.test_run_id=$2 AND m.participant_session_id=$3 AND m.tenant_id=$4 AND m.workspace_id=$5 AND m.content_release_id=$6
      AND p.original_login_key IS NOT NULL AND p.original_name_suffix IS NOT NULL`, [input.testNumber, input.testRunId, input.participantSessionId, input.tenantId, input.workspaceId, input.contentReleaseId]);
    if (!parent.rowCount) throw resultParentUnavailable();
    const prepared = prepareOriginalTestLogs(input, logs);
    for (const log of prepared) await client.query(`INSERT INTO participant_test_logs(participant_test_log_id,tenant_id,workspace_id,participant_session_id,test_run_id,unit_key,original_unit_id,log_key,log_content,timestamp,recorded_at,original_timestamp)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [log.participantTestLogId, log.tenantId, log.workspaceId, log.participantSessionId, log.testRunId, log.unitKey, log.originalUnitId, log.logKey, log.logContent, exactParticipantTestLogTimestamp(log), log.recordedAt, log.originalTimestamp ?? null]);
  });
}
