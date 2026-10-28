import type {DatabaseSync} from 'node:sqlite';
import {assertOriginalTestLogInput, prepareOriginalTestLock, resultParentUnavailable, type OriginalTestNumberRecord} from '@testcenter-rewrite-app/application';
import {withResultArtifactParent} from './result-artifact-parent.js';

export function lockOriginalTest(database: DatabaseSync, input: OriginalTestNumberRecord, timestamp: string): void {
  assertOriginalTestLogInput(input);
  withResultArtifactParent(database, input, () => {
    const parent = database.prepare(`SELECT t.original_result_state_json FROM original_test_numbers m
      JOIN test_runs t ON t.test_run_id=m.test_run_id AND t.participant_session_id=m.participant_session_id AND t.tenant_id=m.tenant_id AND t.workspace_id=m.workspace_id AND t.content_release_id=m.content_release_id
      JOIN participant_sessions p ON p.participant_session_id=m.participant_session_id AND p.tenant_id=m.tenant_id AND p.workspace_id=m.workspace_id AND p.content_release_id=m.content_release_id
      WHERE m.test_number=? AND m.test_run_id=? AND m.participant_session_id=? AND m.tenant_id=? AND m.workspace_id=? AND m.content_release_id=?
      AND p.original_login_key IS NOT NULL AND p.original_name_suffix IS NOT NULL`).get(input.testNumber, input.testRunId, input.participantSessionId, input.tenantId, input.workspaceId, input.contentReleaseId);
    if (!parent) throw resultParentUnavailable();
    const effect = prepareOriginalTestLock(timestamp, parent.original_result_state_json == null ? undefined : JSON.parse(String(parent.original_result_state_json)));
    database.prepare('UPDATE test_runs SET locked=1, updated_at=?, original_result_state_json=? WHERE test_run_id=?')
      .run(effect.updatedAt, JSON.stringify(effect.originalResultState), input.testRunId);
  });
}
