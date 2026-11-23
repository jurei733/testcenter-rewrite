import type {DatabaseSync} from 'node:sqlite';
import {groupAttachmentStorageRunPrefixes, type OriginalAttachmentFileMetadata, type OriginalTestNumberRecord} from '@testcenter-rewrite-app/application';

export function readOriginalAttachmentMetadata(database: DatabaseSync, scope: {tenantId: string; workspaceId: string},
  testRunIds: readonly string[]): OriginalAttachmentFileMetadata[] {
  const sql = `SELECT attachment_id AS attachmentId, attachment_file_id AS attachmentFileId, created_at AS createdAt,
    tenant_id AS tenantId, workspace_id AS workspaceId FROM attachment_files WHERE tenant_id=? AND workspace_id=?
    AND substr(attachment_id, 1, ?) IN (SELECT value FROM json_each(?))`;
  const statement = database.prepare(sql);
  return [...groupAttachmentStorageRunPrefixes(testRunIds)].flatMap(([length, prefixes]) =>
    statement.all(scope.tenantId, scope.workspaceId, length, JSON.stringify(prefixes)) as OriginalAttachmentFileMetadata[]);
}

export function readOriginalAttachmentTestNumbers(database: DatabaseSync, scope: {tenantId: string; workspaceId: string},
  testRunIds: readonly string[]): OriginalTestNumberRecord[] {
  return database.prepare(`SELECT test_run_id AS testRunId, participant_session_id AS participantSessionId, tenant_id AS tenantId,
    workspace_id AS workspaceId, content_release_id AS contentReleaseId, test_number AS testNumber FROM original_test_numbers
    WHERE tenant_id=? AND workspace_id=? AND test_run_id IN (SELECT value FROM json_each(?))`)
    .all(scope.tenantId, scope.workspaceId, JSON.stringify(testRunIds)) as OriginalTestNumberRecord[];
}
