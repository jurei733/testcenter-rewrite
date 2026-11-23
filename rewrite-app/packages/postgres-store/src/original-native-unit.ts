import {originalParticipantGroupKeysEqual} from '@testcenter-rewrite-app/application';
import type {AttachmentFile,OriginalNativeUnit,ParticipantProgressDelivery,TestRun} from '@testcenter-rewrite-app/domain';
import {prepareOriginalAttachmentResponse, type OriginalAttachmentMutation} from '@testcenter-rewrite-app/application';
import {prepareOriginalUnitDelivery} from '@testcenter-rewrite-app/application';
import {assertOriginalUnitInput,assertOriginalUnitRecord,selectOriginalUnitName,prepareOriginalUnitMutation,originalUnitParentMatches,resultParentUnavailable,originalUnitHistoryUnavailable,type OriginalUnitInput,type OriginalUnitTransform} from '@testcenter-rewrite-app/application';
import {withResultArtifactParent} from './result-artifact-parent.js';
import type {Pool,PoolClient} from 'pg';
export async function readOriginalNativeUnitInTransaction(client:PoolClient,input:OriginalUnitInput):Promise<OriginalNativeUnit|null>{
 const parent=await client.query(`SELECT 1 FROM test_runs t JOIN participant_sessions p ON p.participant_session_id=t.participant_session_id AND p.tenant_id=t.tenant_id AND p.workspace_id=t.workspace_id AND p.content_release_id=t.content_release_id
  WHERE t.test_run_id=$1 AND t.participant_session_id=$2 AND t.tenant_id=$3 AND t.workspace_id=$4 AND t.content_release_id=$5`,[input.testRunId,input.participantSessionId,input.tenantId,input.workspaceId,input.contentReleaseId]);
 if(!parent.rowCount)throw resultParentUnavailable();
 const rows=(await client.query('SELECT unit_name,participant_session_id,tenant_id,workspace_id,content_release_id FROM original_native_units WHERE test_run_id=$1',[input.testRunId])).rows;
 for(const row of rows)if(row.participant_session_id!==input.participantSessionId||row.tenant_id!==input.tenantId||row.workspace_id!==input.workspaceId||row.content_release_id!==input.contentReleaseId)throw resultParentUnavailable();
 const name=selectOriginalUnitName(input,rows.map(row=>String(row.unit_name)));
 if(name===null){const legacy=(await client.query(`SELECT json_object_keys(unit_responses_json::json) AS unit_key FROM test_runs WHERE test_run_id=$1
  UNION ALL SELECT unit_key FROM workspace_reviews WHERE test_run_id=$1
  UNION ALL SELECT details_json::json->>'unitKey' AS unit_key FROM workspace_activity_events WHERE subject_type='test_run' AND subject_id=$1 AND event_type IN ('review_created','review_updated','review_deleted')`,[input.testRunId])).rows;
  if(legacy.some(row=>typeof row.unit_key==='string'&&originalParticipantGroupKeysEqual(row.unit_key,input.unitName)))throw originalUnitHistoryUnavailable();return null;}

 const row=(await client.query('SELECT unit_json FROM original_native_units WHERE test_run_id=$1 AND unit_name=$2',[input.testRunId,name])).rows[0];if(!row)return null;
 const unit=JSON.parse(String(row.unit_json)) as OriginalNativeUnit;assertOriginalUnitRecord(unit);if(!originalUnitParentMatches(input,unit)||unit.unitName!==name)throw resultParentUnavailable();return unit;
}
export async function readOriginalNativeUnit(pool:Pool,input:OriginalUnitInput):Promise<OriginalNativeUnit|null>{
 assertOriginalUnitInput(input);return withResultArtifactParent(pool,input,client=>readOriginalNativeUnitInTransaction(client,input));
}
export async function mutateOriginalNativeUnit(pool:Pool,input:OriginalUnitInput,mutation:OriginalUnitTransform | OriginalAttachmentMutation):Promise<OriginalNativeUnit|null>{
 assertOriginalUnitInput(input);return withResultArtifactParent(pool,input,async client=>{
  // Serialize first creation and german2_ci-equivalent aliases without decoding
  // or rewriting the complete canonical Run/other Unit payloads.
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['native-unit:'+input.testRunId]);
  const previous=await readOriginalNativeUnitInTransaction(client,input);
  const saved=input.delivery?(await client.query('SELECT * FROM participant_progress_deliveries WHERE test_run_id=$1 AND delivery_id=$2',[input.testRunId,input.delivery.deliveryId])).rows[0]:undefined;
  if(saved&&(['tenant_id','workspace_id','participant_session_id','content_release_id'] as const).some((key,index)=>saved[key]!==[input.tenantId,input.workspaceId,input.participantSessionId,input.contentReleaseId][index]))throw resultParentUnavailable();
  const receipt=input.delivery?prepareOriginalUnitDelivery(input,input.delivery,saved?(typeof saved.delivery_json==='string'?JSON.parse(saved.delivery_json):saved.delivery_json) as ParticipantProgressDelivery:undefined):undefined;
  if(receipt===null)return previous;
  const effect = typeof mutation === 'function' ? prepareOriginalUnitMutation(input, previous, mutation)
    : {unit: await mutateAttachmentResponse(client, mutation, previous) ?? undefined, logs: []};
  if(effect.unit){const unit=effect.unit;await client.query(`INSERT INTO original_native_units(test_run_id,participant_session_id,tenant_id,workspace_id,content_release_id,unit_name,unit_json) VALUES($1,$2,$3,$4,$5,$6,$7)
   ON CONFLICT(test_run_id,unit_name) DO UPDATE SET unit_json=excluded.unit_json`,[unit.testRunId,unit.participantSessionId,unit.tenantId,unit.workspaceId,unit.contentReleaseId,unit.unitName,JSON.stringify(unit)]);}
  for(const log of effect.logs)await client.query(`INSERT INTO participant_test_logs(participant_test_log_id,tenant_id,workspace_id,participant_session_id,test_run_id,unit_key,original_unit_id,log_key,log_content,timestamp,recorded_at,original_timestamp)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,[log.participantTestLogId,log.tenantId,log.workspaceId,log.participantSessionId,log.testRunId,log.unitKey,log.originalUnitId,log.logKey,log.logContent,log.timestamp,log.recordedAt,log.originalTimestamp??null]);
  if(receipt)await client.query(`INSERT INTO participant_progress_deliveries(test_run_id,delivery_id,tenant_id,workspace_id,participant_session_id,content_release_id,delivery_json) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)`,
   [receipt.testRunId,receipt.deliveryId,receipt.tenantId,receipt.workspaceId,receipt.participantSessionId,receipt.contentReleaseId,JSON.stringify(receipt)]);
  return effect.unit??previous;
 },true);
}

export async function writeAttachmentFile(client:PoolClient, file:AttachmentFile, upsert = false):Promise<void> {
  await client.query(`INSERT INTO attachment_files (
    attachment_file_id, attachment_id, tenant_id, workspace_id, file_name, media_type, data_base64, created_at
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)` + (upsert ? `
  ON CONFLICT(attachment_file_id) DO UPDATE SET attachment_id=EXCLUDED.attachment_id,
    tenant_id=EXCLUDED.tenant_id, workspace_id=EXCLUDED.workspace_id, file_name=EXCLUDED.file_name,
    media_type=EXCLUDED.media_type, data_base64=EXCLUDED.data_base64, created_at=EXCLUDED.created_at` : ''),
  [file.attachmentFileId, file.attachmentId, file.tenantId, file.workspaceId,
    file.fileName, file.mediaType, file.dataBase64, file.createdAt]);
}

async function mutateAttachmentResponse(client:PoolClient, input:OriginalAttachmentMutation,
  previous:OriginalNativeUnit | null):Promise<OriginalNativeUnit | null> {
  const scope = [input.attachmentId, input.tenantId, input.workspaceId];
  const {rows} = await client.query<{attachmentFileId:string;createdAt:string}>(
    'SELECT attachment_file_id AS "attachmentFileId", created_at::text AS "createdAt" FROM attachment_files WHERE attachment_id=$1 AND tenant_id=$2 AND workspace_id=$3', scope);
  const unit = prepareOriginalAttachmentResponse(input, previous, rows);
  if ('file' in input.change) await writeAttachmentFile(client, input.change.file);
  else await client.query('DELETE FROM attachment_files WHERE attachment_id=$1 AND tenant_id=$2 AND workspace_id=$3 AND attachment_file_id=$4',
    [...scope, input.change.deleteFileId]);
  return unit;
}

export async function invalidateOriginalNativeUnits(client:Pick<Pool,'query'>,next:TestRun):Promise<void>{
 const units=(await client.query('SELECT unit_name FROM original_native_units WHERE test_run_id=$1',[next.testRunId])).rows;if(!units.length)return;
 const changes=(await client.query(`WITH before AS (SELECT j.key,j.value FROM test_runs t,jsonb_each_text(t.unit_responses_json::jsonb) j WHERE t.test_run_id=$1),after AS (SELECT key,value FROM jsonb_each_text($2::jsonb))
  SELECT COALESCE(b.key,a.key) AS key FROM before b FULL JOIN after a ON a.key=b.key WHERE a.value IS DISTINCT FROM b.value`,[next.testRunId,JSON.stringify(next.unitResponses)])).rows;
 for(const unit of units)if(changes.some(row=>originalParticipantGroupKeysEqual(String(row.key),String(unit.unit_name))))await client.query(`UPDATE original_native_units SET unit_json=(unit_json::jsonb||'{"unknownHistory":true}'::jsonb)::text WHERE test_run_id=$1 AND unit_name=$2`,[next.testRunId,unit.unit_name]);
}
