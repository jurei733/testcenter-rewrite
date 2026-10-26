import {originalParticipantGroupKeysEqual} from '@testcenter-rewrite-app/application';
import type {OriginalNativeUnit,TestRun} from '@testcenter-rewrite-app/domain';
import {assertOriginalUnitInput,assertOriginalUnitRecord,selectOriginalUnitName,prepareOriginalUnitMutation,originalUnitParentMatches,resultParentUnavailable,originalUnitHistoryUnavailable,type OriginalUnitInput,type OriginalUnitTransform} from '@testcenter-rewrite-app/application';
import {withResultArtifactParent} from './result-artifact-parent.js';
import type {DatabaseSync} from 'node:sqlite';
function read(database:DatabaseSync,input:OriginalUnitInput):OriginalNativeUnit|null{
 const parent=database.prepare(`SELECT 1 FROM test_runs t JOIN participant_sessions p ON p.participant_session_id=t.participant_session_id AND p.tenant_id=t.tenant_id AND p.workspace_id=t.workspace_id AND p.content_release_id=t.content_release_id
  WHERE t.test_run_id=? AND t.participant_session_id=? AND t.tenant_id=? AND t.workspace_id=? AND t.content_release_id=?`).get(input.testRunId,input.participantSessionId,input.tenantId,input.workspaceId,input.contentReleaseId);
 if(!parent)throw resultParentUnavailable();
 const rows=database.prepare('SELECT unit_name,participant_session_id,tenant_id,workspace_id,content_release_id FROM original_native_units WHERE test_run_id=?').all(input.testRunId);
 for(const row of rows)if(row.participant_session_id!==input.participantSessionId||row.tenant_id!==input.tenantId||row.workspace_id!==input.workspaceId||row.content_release_id!==input.contentReleaseId)throw resultParentUnavailable();
 const name=selectOriginalUnitName(input,rows.map(row=>String(row.unit_name)));
 if(name===null){const legacy=database.prepare(`SELECT j.key AS unit_key FROM test_runs t,json_each(t.unit_responses_json) j WHERE t.test_run_id=?
  UNION ALL SELECT unit_key FROM workspace_reviews WHERE test_run_id=?
  UNION ALL SELECT json_extract(details_json,'$.unitKey') AS unit_key FROM workspace_activity_events WHERE subject_type='test_run' AND subject_id=? AND event_type IN ('review_created','review_updated','review_deleted')`).all(input.testRunId,input.testRunId,input.testRunId);
  if(legacy.some(row=>typeof row.unit_key==='string'&&originalParticipantGroupKeysEqual(row.unit_key,input.unitName)))throw originalUnitHistoryUnavailable();return null;}

 const row=database.prepare('SELECT unit_json FROM original_native_units WHERE test_run_id=? AND unit_name=?').get(input.testRunId,name);if(!row)return null;
 const unit=JSON.parse(String(row.unit_json)) as OriginalNativeUnit;assertOriginalUnitRecord(unit);if(!originalUnitParentMatches(input,unit)||unit.unitName!==name)throw resultParentUnavailable();return unit;
}
export function readOriginalNativeUnit(database:DatabaseSync,input:OriginalUnitInput):OriginalNativeUnit|null{
 assertOriginalUnitInput(input);return withResultArtifactParent(database,input,()=>read(database,input));
}
export function mutateOriginalNativeUnit(database:DatabaseSync,input:OriginalUnitInput,transform:OriginalUnitTransform):OriginalNativeUnit|null{
 assertOriginalUnitInput(input);return withResultArtifactParent(database,input,()=>{
  const previous=read(database,input),effect=prepareOriginalUnitMutation(input,previous,transform);
  if(effect.unit){const unit=effect.unit;database.prepare(`INSERT INTO original_native_units(test_run_id,participant_session_id,tenant_id,workspace_id,content_release_id,unit_name,unit_json) VALUES(?,?,?,?,?,?,?)
   ON CONFLICT(test_run_id,unit_name) DO UPDATE SET unit_json=excluded.unit_json`).run(unit.testRunId,unit.participantSessionId,unit.tenantId,unit.workspaceId,unit.contentReleaseId,unit.unitName,JSON.stringify(unit));}
  for(const log of effect.logs)database.prepare(`INSERT INTO participant_test_logs(participant_test_log_id,tenant_id,workspace_id,participant_session_id,test_run_id,unit_key,original_unit_id,log_key,log_content,timestamp,recorded_at,original_timestamp)
   VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(log.participantTestLogId,log.tenantId,log.workspaceId,log.participantSessionId,log.testRunId,log.unitKey,log.originalUnitId,log.logKey,log.logContent,log.timestamp,log.recordedAt,log.originalTimestamp??null);
  return effect.unit??previous;
 });
}
export function invalidateOriginalNativeUnits(database:DatabaseSync,next:TestRun):void{
 const units=database.prepare('SELECT unit_name FROM original_native_units WHERE test_run_id=?').all(next.testRunId);if(!units.length)return;
 const changes=database.prepare(`WITH before AS (SELECT j.key,j.value FROM test_runs t,json_each(t.unit_responses_json) j WHERE t.test_run_id=?),after AS (SELECT key,value FROM json_each(?))
  SELECT b.key FROM before b LEFT JOIN after a ON a.key=b.key WHERE a.value IS NOT b.value
  UNION SELECT a.key FROM after a LEFT JOIN before b ON b.key=a.key WHERE b.value IS NOT a.value`).all(next.testRunId,JSON.stringify(next.unitResponses));
 for(const unit of units)if(changes.some(row=>originalParticipantGroupKeysEqual(String(row.key),String(unit.unit_name))))database.prepare("UPDATE original_native_units SET unit_json=json_set(unit_json,'$.unknownHistory',json('true')) WHERE test_run_id=? AND unit_name=?").run(next.testRunId,unit.unit_name);
}
