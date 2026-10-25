import {rollbackAfterFailure} from './transaction-rollback.js';
import type {DatabaseSync} from 'node:sqlite';
import {prepareOriginalGroupDeletionInput, selectOriginalGroupDeletionKeys, attachmentTestRunId, type OriginalGroupDeletionInput, type OriginalGroupDeletionResult} from '@testcenter-rewrite-app/application';

export function deleteOriginalGroupResults(database: DatabaseSync, raw: OriginalGroupDeletionInput): OriginalGroupDeletionResult | null {
  const input = prepareOriginalGroupDeletionInput(raw);
  database.exec('BEGIN IMMEDIATE');
  try {
    const scope = [input.tenantId, input.workspaceId];
    if (!database.prepare('SELECT workspace_id FROM workspaces WHERE tenant_id=? AND workspace_id=?').get(...scope)) {database.exec('ROLLBACK'); return null;}
    const groupKeys = selectOriginalGroupDeletionKeys(input, database.prepare('SELECT group_key AS groupKey FROM original_participant_groups WHERE tenant_id=? AND workspace_id=?').all(...scope) as Array<{groupKey:string}>);
    // JSON membership parameters keep parameter counts bounded for large groups.
    const logins = database.prepare('SELECT login_key FROM original_login_bindings WHERE tenant_id=? AND workspace_id=? AND group_snapshot_key IN (SELECT value FROM json_each(?))').all(...scope, JSON.stringify(groupKeys)).map(row => String(row.login_key));
    const people = database.prepare('SELECT participant_session_id FROM participant_sessions WHERE tenant_id=? AND workspace_id=? AND original_login_key IN (SELECT value FROM json_each(?))').all(...scope, JSON.stringify(logins)).map(row => String(row.participant_session_id));
    const runs = database.prepare('SELECT test_run_id FROM test_runs WHERE tenant_id=? AND workspace_id=? AND participant_session_id IN (SELECT value FROM json_each(?))').all(...scope, JSON.stringify(people)).map(row => String(row.test_run_id));
    const descendants = 'tenant_id=? AND workspace_id=? AND (participant_session_id IN (SELECT value FROM json_each(?)) OR test_run_id IN (SELECT value FROM json_each(?)))';
    const selected = [...scope, JSON.stringify(people), JSON.stringify(runs)];
    const reviews = database.prepare('SELECT review_id FROM workspace_reviews WHERE '+descendants).all(...selected).map(row => String(row.review_id));
    const runSet = new Set(runs);
    const attachments = database.prepare('SELECT attachment_file_id,attachment_id FROM attachment_files WHERE tenant_id=? AND workspace_id=?').all(...scope)
      .filter(row => runSet.has(attachmentTestRunId(String(row.attachment_id)) ?? '')).map(row => String(row.attachment_file_id));
    const deletedAttachmentFileCount = Number(database.prepare('DELETE FROM attachment_files WHERE tenant_id=? AND workspace_id=? AND attachment_file_id IN (SELECT value FROM json_each(?))').run(...scope, JSON.stringify(attachments)).changes);
    database.prepare(`DELETE FROM workspace_activity_events WHERE tenant_id=?1 AND workspace_id=?2 AND (
      subject_type='participant_session' AND subject_id IN (SELECT value FROM json_each(?3)) OR subject_type='test_run' AND subject_id IN (SELECT value FROM json_each(?4)) OR
      json_extract(details_json,'$.participantSessionId') IN (SELECT value FROM json_each(?3)) OR json_extract(details_json,'$.testRunId') IN (SELECT value FROM json_each(?4)) OR json_extract(details_json,'$.reviewId') IN (SELECT value FROM json_each(?5)))`)
      .run(...selected, JSON.stringify(reviews));
    const deletedReviewCount = Number(database.prepare('DELETE FROM workspace_reviews WHERE '+descendants).run(...selected).changes);
    const deletedLogCount = Number(database.prepare('DELETE FROM participant_test_logs WHERE '+descendants).run(...selected).changes);
    database.prepare('DELETE FROM participant_run_commands WHERE '+descendants).run(...selected);
    database.prepare('DELETE FROM participant_progress_deliveries WHERE '+descendants).run(...selected);
    database.prepare('DELETE FROM participant_connection_presence WHERE test_run_id IN (SELECT value FROM json_each(?))').run(JSON.stringify(runs));
    database.prepare('DELETE FROM participant_access_credentials WHERE participant_session_id IN (SELECT value FROM json_each(?))').run(JSON.stringify(people));
    const deletedTestCount = Number(database.prepare('DELETE FROM test_runs WHERE tenant_id=? AND workspace_id=? AND test_run_id IN (SELECT value FROM json_each(?))').run(...scope, JSON.stringify(runs)).changes);
    const deletedPersonCount = Number(database.prepare('DELETE FROM participant_sessions WHERE tenant_id=? AND workspace_id=? AND participant_session_id IN (SELECT value FROM json_each(?))').run(...scope, JSON.stringify(people)).changes);
    const deletedLoginCount = Number(database.prepare('DELETE FROM original_login_bindings WHERE tenant_id=? AND workspace_id=? AND login_key IN (SELECT value FROM json_each(?))').run(...scope, JSON.stringify(logins)).changes);
    const deletedGroupCount = Number(database.prepare('DELETE FROM original_participant_groups WHERE tenant_id=? AND workspace_id=? AND group_key IN (SELECT value FROM json_each(?))').run(...scope, JSON.stringify(groupKeys)).changes);
    database.exec('COMMIT');
    return {deletedGroupCount, deletedLoginCount, deletedPersonCount, deletedTestCount, deletedReviewCount, deletedLogCount, deletedAttachmentFileCount};
  } catch (error) {return rollbackAfterFailure(database, error);}
}
