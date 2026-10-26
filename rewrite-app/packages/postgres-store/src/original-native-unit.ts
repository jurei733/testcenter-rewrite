import {originalParticipantGroupKeysEqual} from '@testcenter-rewrite-app/application';
import type {OriginalNativeUnit,TestRun} from '@testcenter-rewrite-app/domain';
import {assertOriginalUnitInput,assertOriginalUnitRecord,selectOriginalUnitName,prepareOriginalUnitMutation,originalUnitParentMatches,resultParentUnavailable,originalUnitHistoryUnavailable,type OriginalUnitInput,type OriginalUnitTransform} from '@testcenter-rewrite-app/application';
import {withResultArtifactParent} from './result-artifact-parent.js';
import type {Pool,PoolClient} from 'pg';
async function read(client:PoolClient,input:OriginalUnitInput):Promise<OriginalNativeUnit|null>{
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
 assertOriginalUnitInput(input);return withResultArtifactParent(pool,input,client=>read(client,input));
}
export async function mutateOriginalNativeUnit(pool:Pool,input:OriginalUnitInput,transform:OriginalUnitTransform):Promise<OriginalNativeUnit|null>{
 assertOriginalUnitInput(input);return withResultArtifactParent(pool,input,async client=>{
  // Serialize first creation and german2_ci-equivalent aliases without decoding
  // or rewriting the complete canonical Run/other Unit payloads.
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['native-unit:'+input.testRunId]);
  const previous=await read(client,input),effect=prepareOriginalUnitMutation(input,previous,transform);
  if(effect.unit){const unit=effect.unit;await client.query(`INSERT INTO original_native_units(test_run_id,participant_session_id,tenant_id,workspace_id,content_release_id,unit_name,unit_json) VALUES($1,$2,$3,$4,$5,$6,$7)
   ON CONFLICT(test_run_id,unit_name) DO UPDATE SET unit_json=excluded.unit_json`,[unit.testRunId,unit.participantSessionId,unit.tenantId,unit.workspaceId,unit.contentReleaseId,unit.unitName,JSON.stringify(unit)]);}
  for(const log of effect.logs)await client.query(`INSERT INTO participant_test_logs(participant_test_log_id,tenant_id,workspace_id,participant_session_id,test_run_id,unit_key,original_unit_id,log_key,log_content,timestamp,recorded_at,original_timestamp)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,[log.participantTestLogId,log.tenantId,log.workspaceId,log.participantSessionId,log.testRunId,log.unitKey,log.originalUnitId,log.logKey,log.logContent,log.timestamp,log.recordedAt,log.originalTimestamp??null]);
  return effect.unit??previous;
 },true);
}
export async function invalidateOriginalNativeUnits(client:Pick<Pool,'query'>,next:TestRun):Promise<void>{
 const units=(await client.query('SELECT unit_name FROM original_native_units WHERE test_run_id=$1',[next.testRunId])).rows;if(!units.length)return;
 const changes=(await client.query(`WITH before AS (SELECT j.key,j.value FROM test_runs t,jsonb_each_text(t.unit_responses_json::jsonb) j WHERE t.test_run_id=$1),after AS (SELECT key,value FROM jsonb_each_text($2::jsonb))
  SELECT COALESCE(b.key,a.key) AS key FROM before b FULL JOIN after a ON a.key=b.key WHERE a.value IS DISTINCT FROM b.value`,[next.testRunId,JSON.stringify(next.unitResponses)])).rows;
 for(const unit of units)if(changes.some(row=>originalParticipantGroupKeysEqual(String(row.key),String(unit.unit_name))))await client.query(`UPDATE original_native_units SET unit_json=(unit_json::jsonb||'{"unknownHistory":true}'::jsonb)::text WHERE test_run_id=$1 AND unit_name=$2`,[next.testRunId,unit.unit_name]);
}
