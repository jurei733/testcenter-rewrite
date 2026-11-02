import {guardOriginalWorkspaceWrite} from './original-workspace-write.js';
import type {DatabaseSync} from 'node:sqlite';
import {prepareOriginalTestDeletionInput,selectOriginalTestDeletion,attachmentTestRunId,type OriginalTestDeletionInput,type OriginalTestDeletionResult} from '@testcenter-rewrite-app/application';
import {readOriginalTestAdministrationInventory} from './original-test-administration.js';
import {rollbackAfterFailure} from './transaction-rollback.js';

export function deleteOriginalSelectedTests(database:DatabaseSync,raw:OriginalTestDeletionInput):OriginalTestDeletionResult|null {
  const input=prepareOriginalTestDeletionInput(raw);database.exec('BEGIN IMMEDIATE');
  try {
    const scope=[input.tenantId,input.workspaceId];
    if(!database.prepare('SELECT workspace_id FROM workspaces WHERE tenant_id=? AND workspace_id=?').get(...scope)){database.exec('ROLLBACK');return null;}
    guardOriginalWorkspaceWrite(database,input);
    const selected=selectOriginalTestDeletion(input,readOriginalTestAdministrationInventory(database,input.tenantId,input.workspaceId));
    const runs=new Set(selected.testRunIds),parameters=[...scope,JSON.stringify(selected.testRunIds)];
    const descendants='tenant_id=? AND workspace_id=? AND test_run_id IN (SELECT value FROM json_each(?))';
    const reviews=database.prepare('SELECT review_id FROM workspace_reviews WHERE '+descendants).all(...parameters).map(row=>String(row.review_id));
    const attachments=database.prepare('SELECT attachment_file_id,attachment_id FROM attachment_files WHERE tenant_id=? AND workspace_id=?').all(...scope).filter(row=>runs.has(attachmentTestRunId(String(row.attachment_id))??'')).map(row=>String(row.attachment_file_id));
    const deletedAttachmentFileCount=Number(database.prepare('DELETE FROM attachment_files WHERE tenant_id=? AND workspace_id=? AND attachment_file_id IN (SELECT value FROM json_each(?))').run(...scope,JSON.stringify(attachments)).changes);
    database.prepare("DELETE FROM workspace_activity_events WHERE tenant_id=?1 AND workspace_id=?2 AND (subject_type='test_run' AND subject_id IN (SELECT value FROM json_each(?3)) OR json_extract(details_json,'$.testRunId') IN (SELECT value FROM json_each(?3)) OR json_extract(details_json,'$.reviewId') IN (SELECT value FROM json_each(?4)))").run(...parameters,JSON.stringify(reviews));
    const deletedReviewCount=Number(database.prepare('DELETE FROM workspace_reviews WHERE '+descendants).run(...parameters).changes);
    const deletedLogCount=Number(database.prepare('DELETE FROM participant_test_logs WHERE '+descendants).run(...parameters).changes);
    database.prepare('DELETE FROM participant_run_commands WHERE '+descendants).run(...parameters);
    database.prepare('DELETE FROM participant_progress_deliveries WHERE '+descendants).run(...parameters);
    database.prepare('DELETE FROM participant_connection_presence WHERE test_run_id IN (SELECT value FROM json_each(?))').run(parameters[2]!);
    const deletedTestCount=Number(database.prepare('DELETE FROM test_runs WHERE '+descendants).run(...parameters).changes);
    database.prepare('UPDATE original_participant_groups SET last_modified_at=? WHERE tenant_id=? AND workspace_id=? AND group_key IN (SELECT value FROM json_each(?))').run(new Date().toISOString(),...scope,JSON.stringify(selected.groupKeys));
    database.exec('COMMIT');return {deletedTestCount,deletedReviewCount,deletedLogCount,deletedAttachmentFileCount};
  }catch(error){return rollbackAfterFailure(database,error);}
}
