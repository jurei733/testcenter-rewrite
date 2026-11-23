import type {PoolClient} from 'pg';
import {groupAttachmentStorageRunPrefixes, type OriginalAttachmentFileMetadata, type OriginalTestNumberRecord} from '@testcenter-rewrite-app/application';

export async function readOriginalAttachmentMetadata(client: PoolClient, scope: {tenantId: string; workspaceId: string},
  testRunIds: readonly string[]): Promise<OriginalAttachmentFileMetadata[]> {
  const sql = `SELECT attachment_id AS "attachmentId", attachment_file_id AS "attachmentFileId", created_at AS "createdAt",
    tenant_id AS "tenantId", workspace_id AS "workspaceId" FROM attachment_files WHERE tenant_id=$1 AND workspace_id=$2
    AND left(attachment_id, $3) IN (SELECT unnest($4::text[]))`;
  const files: OriginalAttachmentFileMetadata[] = [];
  for (const [length, prefixes] of groupAttachmentStorageRunPrefixes(testRunIds)) {
    const {rows} = await client.query<OriginalAttachmentFileMetadata>(sql, [scope.tenantId, scope.workspaceId, length, prefixes]);
    files.push(...rows);
  }
  return files;
}

export async function readOriginalAttachmentTestNumbers(client: PoolClient, scope: {tenantId: string; workspaceId: string},
  testRunIds: readonly string[]): Promise<OriginalTestNumberRecord[]> {
  const {rows} = await client.query<OriginalTestNumberRecord>(`SELECT test_run_id AS "testRunId", participant_session_id AS "participantSessionId",
    tenant_id AS "tenantId", workspace_id AS "workspaceId", content_release_id AS "contentReleaseId", test_number AS "testNumber"
    FROM original_test_numbers WHERE tenant_id=$1 AND workspace_id=$2 AND test_run_id=ANY($3::text[])`,
    [scope.tenantId, scope.workspaceId, testRunIds]);
  return rows;
}
