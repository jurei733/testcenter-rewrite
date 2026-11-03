import {selectOriginalReportParents,projectOriginalWorkspaceReport,assertOriginalReportRowCount,type OriginalReportMetadata,type OriginalReportFamily,type OriginalReportRequest,type OriginalWorkspaceReportSnapshot,type OriginalReportStoredUnit,type OriginalReportStoredReview} from '@testcenter-rewrite-app/application';
import {readParticipantTestLogTimestamp,type ParticipantTestLog} from '@testcenter-rewrite-app/domain';
import type {Pool} from 'pg';
type Row=Record<string,unknown>;
const scope=(row:Row)=>({testRunId:row.testRunId as string,participantSessionId:row.participantSessionId as string,tenantId:row.tenantId as string,workspaceId:row.workspaceId as string,contentReleaseId:row.contentReleaseId as string});
const unitIdentity=(row:Row):OriginalReportStoredUnit=>({...scope(row),unitName:row.unitName as string,unit:{
 testRunId:row.unit_testRunId as string,participantSessionId:row.unit_participantSessionId as string,tenantId:row.unit_tenantId as string,workspaceId:row.unit_workspaceId as string,contentReleaseId:row.unit_contentReleaseId as string,unitName:row.unit_unitName as string,originalUnitId:row.unit_originalUnitId as string}});
/** Every metadata/family read shares one read-only repeatable-read snapshot.
 * No writer lock or full private Run document is needed. */
export async function readOriginalWorkspaceReportSnapshot(pool:Pool,input:OriginalReportRequest):Promise<OriginalWorkspaceReportSnapshot>{
 const client=await pool.connect();
 try{await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const all=async(sql:string,args:unknown[]):Promise<Row[]> => (await client.query(sql,args)).rows;
 const args=[input.tenantId,input.workspaceId];
 const metadata:OriginalReportMetadata={people:await all("SELECT participant_session_id AS \"participantSessionId\",tenant_id AS \"tenantId\",workspace_id AS \"workspaceId\",content_release_id AS \"contentReleaseId\",group_key AS \"groupKey\",original_login_key AS \"originalLoginKey\",original_name_suffix AS \"originalNameSuffix\" FROM participant_sessions WHERE tenant_id=$1 AND workspace_id=$2",args) as unknown as OriginalReportMetadata['people'],
  bindings:await all("SELECT tenant_id AS \"tenantId\",workspace_id AS \"workspaceId\",login_key AS \"loginKey\",group_key AS \"groupKey\" FROM original_login_bindings WHERE tenant_id=$1 AND workspace_id=$2",args) as unknown as OriginalReportMetadata['bindings'],runs:await all("SELECT test_run_id AS \"testRunId\",participant_session_id AS \"participantSessionId\",tenant_id AS \"tenantId\",workspace_id AS \"workspaceId\",content_release_id AS \"contentReleaseId\",original_result_state_json->>'bookletName' AS \"bookletName\" FROM test_runs WHERE tenant_id=$1 AND workspace_id=$2",args) as unknown as OriginalReportMetadata['runs']};
 const parents=selectOriginalReportParents(metadata,input),runIds=parents.map(p=>p.run.testRunId),selected=[runIds];
 const family:OriginalReportFamily={units:[],legacyUnits:[],logs:[],reviews:[],legacyReviews:[],testNumbers:[],personNumbers:[]};
 if(runIds.length){
 if(input.type==='response'){
  const units=await all("SELECT test_run_id AS \"testRunId\",participant_session_id AS \"participantSessionId\",tenant_id AS \"tenantId\",workspace_id AS \"workspaceId\",content_release_id AS \"contentReleaseId\",unit_name AS \"unitName\",unit_json AS payload FROM original_native_units WHERE test_run_id=ANY($1::text[]) LIMIT 50001",selected);assertOriginalReportRowCount(units.length);
  family.units=units.map(row=>({...scope(row),unitName:row.unitName as string,unit:JSON.parse(String(row.payload))}));
  family.legacyUnits=[...await all("SELECT t.test_run_id AS \"testRunId\",j.key AS \"unitName\" FROM test_runs t CROSS JOIN LATERAL jsonb_object_keys(t.unit_responses_json::jsonb) j(key) WHERE t.test_run_id=ANY($1::text[])",selected),...await all("SELECT test_run_id AS \"testRunId\",unit_key AS \"unitName\" FROM workspace_reviews WHERE test_run_id=ANY($1::text[]) AND unit_key IS NOT NULL",selected),...await all("SELECT subject_id AS \"testRunId\",details_json::json->>'unitKey' AS \"unitName\" FROM workspace_activity_events WHERE subject_id=ANY($1::text[]) AND subject_type='test_run' AND event_type IN ('review_created','review_updated','review_deleted') AND details_json::json->>'unitKey' IS NOT NULL",selected)] as unknown as OriginalReportFamily['legacyUnits'];
 }else{
  family.units=(await all("SELECT test_run_id AS \"testRunId\",participant_session_id AS \"participantSessionId\",tenant_id AS \"tenantId\",workspace_id AS \"workspaceId\",content_release_id AS \"contentReleaseId\",unit_name AS \"unitName\",unit_json::json->>'testRunId' AS \"unit_testRunId\",unit_json::json->>'participantSessionId' AS \"unit_participantSessionId\",unit_json::json->>'tenantId' AS \"unit_tenantId\",unit_json::json->>'workspaceId' AS \"unit_workspaceId\",unit_json::json->>'contentReleaseId' AS \"unit_contentReleaseId\",unit_json::json->>'unitName' AS \"unit_unitName\",unit_json::json->>'originalUnitId' AS \"unit_originalUnitId\" FROM original_native_units WHERE test_run_id=ANY($1::text[])",selected)).map(unitIdentity);
  if(input.type==='log'){
   const logs=await all("SELECT participant_test_log_id AS \"participantTestLogId\",tenant_id AS \"tenantId\",workspace_id AS \"workspaceId\",participant_session_id AS \"participantSessionId\",test_run_id AS \"testRunId\",unit_key AS \"unitKey\",original_unit_id AS \"originalUnitId\",log_key AS \"logKey\",log_content AS \"logContent\",CAST(timestamp AS TEXT) AS timestamp,recorded_at AS \"recordedAt\",original_timestamp AS \"originalTimestamp\" FROM participant_test_logs WHERE test_run_id=ANY($1::text[]) LIMIT 50001",selected);assertOriginalReportRowCount(logs.length);
   family.logs=logs.map(row=>({...row,...readParticipantTestLogTimestamp(row.timestamp),...(row.originalTimestamp===0?{originalTimestamp:0 as const}:{originalTimestamp:undefined})})) as unknown as ParticipantTestLog[];
  }else{
   const reviews=await all("SELECT test_run_id AS \"testRunId\",participant_session_id AS \"participantSessionId\",tenant_id AS \"tenantId\",workspace_id AS \"workspaceId\",content_release_id AS \"contentReleaseId\",review_number AS \"reviewNumber\",review_id AS \"reviewId\",kind,review_json AS payload FROM original_native_reviews WHERE test_run_id=ANY($1::text[]) LIMIT 50001",selected);assertOriginalReportRowCount(reviews.length);
   family.reviews=reviews.map(row=>({...scope(row),kind:row.kind as string,reviewNumber:row.reviewNumber as string,reviewId:row.reviewId as string,review:JSON.parse(String(row.payload))})) as OriginalReportStoredReview[];
   family.legacyReviews=await all("SELECT test_run_id AS \"testRunId\",review_id AS \"reviewId\" FROM workspace_reviews WHERE test_run_id=ANY($1::text[])",selected) as unknown as OriginalReportFamily['legacyReviews'];
   family.testNumbers=await all("SELECT test_run_id AS \"testRunId\",participant_session_id AS \"participantSessionId\",tenant_id AS \"tenantId\",workspace_id AS \"workspaceId\",content_release_id AS \"contentReleaseId\",test_number AS \"testNumber\" FROM original_test_numbers WHERE test_run_id=ANY($1::text[])",selected) as unknown as OriginalReportFamily['testNumbers'];
   const people=parents.map(p=>p.person.participantSessionId);
   family.personNumbers=await all("SELECT participant_session_id AS \"participantSessionId\",tenant_id AS \"tenantId\",workspace_id AS \"workspaceId\",original_login_key AS \"originalLoginKey\",original_name_suffix AS \"originalNameSuffix\",person_number AS \"personNumber\" FROM original_person_numbers WHERE participant_session_id=ANY($1::text[])",[people]) as unknown as OriginalReportFamily['personNumbers'];
  }
 }
 }
 const result=projectOriginalWorkspaceReport(input,parents,family);
 await client.query('COMMIT');return result;
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
