import {guardOriginalWorkspaceWrite} from './original-workspace-write.js';
import type {Pool} from 'pg';
import {prepareOriginalTestDeletionInput,selectOriginalTestDeletion,attachmentTestRunId,type OriginalTestDeletionInput,type OriginalTestDeletionResult} from '@testcenter-rewrite-app/application';
import {readOriginalTestAdministrationInventory} from './original-test-administration.js';

export async function deleteOriginalSelectedTests(pool:Pool,raw:OriginalTestDeletionInput):Promise<OriginalTestDeletionResult|null> {
  const input=prepareOriginalTestDeletionInput(raw),client=await pool.connect();
  try {
    await client.query('BEGIN');const scope=[input.tenantId,input.workspaceId];
    if(!(await client.query('SELECT workspace_id FROM workspaces WHERE tenant_id=$1 AND workspace_id=$2 FOR NO KEY UPDATE',scope)).rowCount){await client.query('ROLLBACK');return null;}
    // All people before any Run, matching creation and artifact writer locks.
    await client.query('SELECT participant_session_id FROM participant_sessions WHERE tenant_id=$1 AND workspace_id=$2 AND original_login_key=ANY($3::text[]) ORDER BY participant_session_id FOR UPDATE',[...scope,[...new Set(input.personSessions.map(row=>row.loginName))]]);
    await guardOriginalWorkspaceWrite(client,input);
    const selected=selectOriginalTestDeletion(input,await readOriginalTestAdministrationInventory(client,input.tenantId,input.workspaceId));
    await client.query('SELECT test_run_id FROM test_runs WHERE tenant_id=$1 AND workspace_id=$2 AND test_run_id=ANY($3::text[]) ORDER BY test_run_id FOR UPDATE',[...scope,selected.testRunIds]);
    const runs=new Set(selected.testRunIds),parameters=[...scope,selected.testRunIds];
    const descendants='tenant_id=$1 AND workspace_id=$2 AND test_run_id=ANY($3::text[])';
    const reviews=(await client.query('SELECT review_id FROM workspace_reviews WHERE '+descendants,parameters)).rows.map(row=>String(row.review_id));
    const attachments=(await client.query('SELECT attachment_file_id,attachment_id FROM attachment_files WHERE tenant_id=$1 AND workspace_id=$2',scope)).rows.filter(row=>runs.has(attachmentTestRunId(String(row.attachment_id))??'')).map(row=>String(row.attachment_file_id));
    await guardOriginalWorkspaceWrite(client,input);
    const deletedAttachmentFileCount=(await client.query('DELETE FROM attachment_files WHERE tenant_id=$1 AND workspace_id=$2 AND attachment_file_id=ANY($3::text[])',[...scope,attachments])).rowCount??0;
    await client.query("DELETE FROM workspace_activity_events WHERE tenant_id=$1 AND workspace_id=$2 AND (subject_type='test_run' AND subject_id=ANY($3::text[]) OR details_json::jsonb->>'testRunId'=ANY($3::text[]) OR details_json::jsonb->>'reviewId'=ANY($4::text[]))",[...parameters,reviews]);
    const deletedReviewCount=(await client.query('DELETE FROM workspace_reviews WHERE '+descendants,parameters)).rowCount??0;
    const deletedLogCount=(await client.query('DELETE FROM participant_test_logs WHERE '+descendants,parameters)).rowCount??0;
    await client.query('DELETE FROM participant_run_commands WHERE '+descendants,parameters);
    await client.query('DELETE FROM participant_progress_deliveries WHERE '+descendants,parameters);
    await client.query('DELETE FROM participant_connection_presence WHERE test_run_id=ANY($1::text[])',[selected.testRunIds]);
    const deletedTestCount=(await client.query('DELETE FROM test_runs WHERE '+descendants,parameters)).rowCount??0;
    await client.query('UPDATE original_participant_groups SET last_modified_at=$1 WHERE tenant_id=$2 AND workspace_id=$3 AND group_key=ANY($4::text[])',[new Date().toISOString(),...scope,selected.groupKeys]);
    await client.query('COMMIT');return {deletedTestCount,deletedReviewCount,deletedLogCount,deletedAttachmentFileCount};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
