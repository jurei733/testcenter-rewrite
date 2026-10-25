import type {Pool} from 'pg';
import {prepareOriginalGroupDeletionInput, selectOriginalGroupDeletionKeys, attachmentTestRunId, type OriginalGroupDeletionInput, type OriginalGroupDeletionResult} from '@testcenter-rewrite-app/application';

export async function deleteOriginalGroupResults(pool: Pool, raw: OriginalGroupDeletionInput): Promise<OriginalGroupDeletionResult | null> {
  const input = prepareOriginalGroupDeletionInput(raw), client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Same ordering as native authentication/first Test creation. NO KEY UPDATE
    // permits the workspace FK reference of an already running child mutation.
    const parent = await client.query('SELECT workspace_id FROM workspaces WHERE tenant_id=$1 AND workspace_id=$2 FOR NO KEY UPDATE', [input.tenantId, input.workspaceId]);
    if (!parent.rowCount) {await client.query('ROLLBACK'); return null;}
    const scope = [input.tenantId, input.workspaceId];
    const groupKeys = selectOriginalGroupDeletionKeys(input, (await client.query('SELECT group_key AS "groupKey" FROM original_participant_groups WHERE tenant_id=$1 AND workspace_id=$2', scope)).rows);
    const logins = (await client.query('SELECT login_key FROM original_login_bindings WHERE tenant_id=$1 AND workspace_id=$2 AND group_snapshot_key=ANY($3::text[])', [...scope, groupKeys])).rows.map(row => String(row.login_key));
    const people = (await client.query('SELECT participant_session_id FROM participant_sessions WHERE tenant_id=$1 AND workspace_id=$2 AND original_login_key=ANY($3::text[]) ORDER BY participant_session_id FOR UPDATE', [...scope, logins])).rows.map(row => String(row.participant_session_id));
    const runs = (await client.query('SELECT test_run_id FROM test_runs WHERE tenant_id=$1 AND workspace_id=$2 AND participant_session_id=ANY($3::text[]) ORDER BY test_run_id FOR UPDATE', [...scope, people])).rows.map(row => String(row.test_run_id));
    const descendants = 'tenant_id=$1 AND workspace_id=$2 AND (participant_session_id=ANY($3::text[]) OR test_run_id=ANY($4::text[]))';
    const selected = [...scope, people, runs];
    const reviews = (await client.query('SELECT review_id FROM workspace_reviews WHERE '+descendants, selected)).rows.map(row => String(row.review_id));
    const runSet = new Set(runs);
    const attachments = (await client.query('SELECT attachment_file_id,attachment_id FROM attachment_files WHERE tenant_id=$1 AND workspace_id=$2', scope)).rows
      .filter(row => runSet.has(attachmentTestRunId(String(row.attachment_id)) ?? '')).map(row => String(row.attachment_file_id));
    const deletedAttachmentFileCount = (await client.query('DELETE FROM attachment_files WHERE tenant_id=$1 AND workspace_id=$2 AND attachment_file_id=ANY($3::text[])', [...scope, attachments])).rowCount ?? 0;
    await client.query(`DELETE FROM workspace_activity_events WHERE tenant_id=$1 AND workspace_id=$2 AND (
      subject_type='participant_session' AND subject_id=ANY($3::text[]) OR subject_type='test_run' AND subject_id=ANY($4::text[]) OR
      details_json::jsonb->>'participantSessionId'=ANY($3::text[]) OR details_json::jsonb->>'testRunId'=ANY($4::text[]) OR details_json::jsonb->>'reviewId'=ANY($5::text[]))`, [...selected, reviews]);
    const deletedReviewCount = (await client.query('DELETE FROM workspace_reviews WHERE '+descendants, selected)).rowCount ?? 0;
    const deletedLogCount = (await client.query('DELETE FROM participant_test_logs WHERE '+descendants, selected)).rowCount ?? 0;
    await client.query('DELETE FROM participant_run_commands WHERE '+descendants, selected);
    await client.query('DELETE FROM participant_progress_deliveries WHERE '+descendants, selected);
    await client.query('DELETE FROM participant_connection_presence WHERE test_run_id=ANY($1::text[])', [runs]);
    await client.query('DELETE FROM participant_access_credentials WHERE participant_session_id=ANY($1::text[])', [people]);
    const deletedTestCount = (await client.query('DELETE FROM test_runs WHERE tenant_id=$1 AND workspace_id=$2 AND test_run_id=ANY($3::text[])', [...scope, runs])).rowCount ?? 0;
    const deletedPersonCount = (await client.query('DELETE FROM participant_sessions WHERE tenant_id=$1 AND workspace_id=$2 AND participant_session_id=ANY($3::text[])', [...scope, people])).rowCount ?? 0;
    // Token FKs cascade with their exact Login/group subjects. Authored roster,
    // password definitions and retained content are intentionally separate.
    const deletedLoginCount = (await client.query('DELETE FROM original_login_bindings WHERE tenant_id=$1 AND workspace_id=$2 AND login_key=ANY($3::text[])', [...scope, logins])).rowCount ?? 0;
    const deletedGroupCount = (await client.query('DELETE FROM original_participant_groups WHERE tenant_id=$1 AND workspace_id=$2 AND group_key=ANY($3::text[])', [...scope, groupKeys])).rowCount ?? 0;
    await client.query('COMMIT');
    return {deletedGroupCount, deletedLoginCount, deletedPersonCount, deletedTestCount, deletedReviewCount, deletedLogCount, deletedAttachmentFileCount};
  } catch (error) {await client.query('ROLLBACK'); throw error;} finally {client.release();}
}
