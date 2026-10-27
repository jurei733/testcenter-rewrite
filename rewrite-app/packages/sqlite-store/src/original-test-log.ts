import {assertOriginalTestLogInput, prepareOriginalTestLogs, resultParentUnavailable, type OriginalTestNumberRecord} from '@testcenter-rewrite-app/application';
import type {ParticipantTestLog} from '@testcenter-rewrite-app/domain';
import type {DatabaseSync} from 'node:sqlite';
import {withResultArtifactParent} from './result-artifact-parent.js';

export function appendOriginalTestLogs(database: DatabaseSync, input: OriginalTestNumberRecord, logs: ParticipantTestLog[]): void {
  assertOriginalTestLogInput(input);
  withResultArtifactParent(database, input, () => {
    const parent = database.prepare(`SELECT 1 FROM original_test_numbers m
      JOIN test_runs t ON t.test_run_id=m.test_run_id AND t.participant_session_id=m.participant_session_id AND t.tenant_id=m.tenant_id AND t.workspace_id=m.workspace_id AND t.content_release_id=m.content_release_id
      JOIN participant_sessions p ON p.participant_session_id=m.participant_session_id AND p.tenant_id=m.tenant_id AND p.workspace_id=m.workspace_id AND p.content_release_id=m.content_release_id
      WHERE m.test_number=? AND m.test_run_id=? AND m.participant_session_id=? AND m.tenant_id=? AND m.workspace_id=? AND m.content_release_id=?
      AND p.original_login_key IS NOT NULL AND p.original_name_suffix IS NOT NULL`).get(input.testNumber, input.testRunId, input.participantSessionId, input.tenantId, input.workspaceId, input.contentReleaseId);
    if (!parent) throw resultParentUnavailable();
    const prepared = prepareOriginalTestLogs(input, logs);
    const insert = database.prepare(`INSERT INTO participant_test_logs(participant_test_log_id,tenant_id,workspace_id,participant_session_id,test_run_id,unit_key,original_unit_id,log_key,log_content,timestamp,recorded_at,original_timestamp)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const log of prepared) insert.run(log.participantTestLogId, log.tenantId, log.workspaceId, log.participantSessionId, log.testRunId, log.unitKey, log.originalUnitId, log.logKey, log.logContent, log.timestamp, log.recordedAt, log.originalTimestamp ?? null);
  });
}
