import type {Pool} from 'pg';
import {assertOriginalMonitorActor,originalMonitorGroupSelection,prepareOriginalMonitorSelectedLock,type OriginalMonitorActor,type OriginalMonitorLockResult} from '@testcenter-rewrite-app/application';
import {readOriginalMonitorActorData} from './original-monitor-session.js';
export async function changeOriginalMonitorTestLock(pool:Pool,actor:OriginalMonitorActor,groupKey:string,testNumber:string,locked:boolean,timestamp:string):Promise<OriginalMonitorLockResult> {
 const db=await pool.connect();
 try {
  await db.query('BEGIN');const args=[actor.tenantId,actor.workspaceId];
  const initial=(await db.query('SELECT participant_session_id,test_run_id FROM original_test_numbers WHERE test_number=$1 AND tenant_id=$2 AND workspace_id=$3',[testNumber,...args])).rows[0];
  // Same parent-before-Run order as result deletion. Stable person ordering also
  // handles the monitor selecting its own genuine Test without duplicate locks.
  await db.query('SELECT participant_session_id FROM participant_sessions WHERE participant_session_id=ANY($1::text[]) ORDER BY participant_session_id FOR UPDATE',[[...new Set([actor.participantSessionId,...(initial?[initial.participant_session_id]:[])])]]);
  if(initial)await db.query('SELECT test_run_id FROM test_runs WHERE test_run_id=$1 FOR UPDATE',[initial.test_run_id]);
  await db.query('SELECT login_key FROM original_login_bindings WHERE tenant_id=$1 AND workspace_id=$2 FOR SHARE',args);
  await db.query('SELECT login_key FROM participant_roster_entries WHERE tenant_id=$1 AND workspace_id=$2 FOR SHARE',args);
  await db.query('SELECT native_logins_json FROM operational_login_migration_candidates WHERE tenant_id=$1 AND workspace_id=$2 FOR SHARE',args);
  await db.query('SELECT tenant_id FROM tenants WHERE tenant_id=$1 FOR SHARE',[actor.tenantId]);
  await db.query('SELECT workspace_id FROM workspaces WHERE tenant_id=$1 AND workspace_id=$2 FOR SHARE',args);
  const data=await readOriginalMonitorActorData(db,actor);assertOriginalMonitorActor(data,actor);originalMonitorGroupSelection(actor,groupKey);
  data.personNumbers=(await db.query('SELECT person_number,participant_session_id,tenant_id,workspace_id,original_login_key,original_name_suffix FROM original_person_numbers WHERE participant_session_id=$1 AND tenant_id=$2 AND workspace_id=$3',[actor.participantSessionId,...args])).rows.map(r=>({personNumber:String(r.person_number),participantSessionId:String(r.participant_session_id),tenantId:String(r.tenant_id),workspaceId:String(r.workspace_id),originalLoginKey:String(r.original_login_key),originalNameSuffix:String(r.original_name_suffix)}));
  data.entries=(await db.query('SELECT tenant_id,workspace_id,login_key,group_key,original_login_identity FROM participant_roster_entries WHERE tenant_id=$1 AND workspace_id=$2',args)).rows.map(r=>({tenantId:String(r.tenant_id),workspaceId:String(r.workspace_id),loginKey:String(r.login_key),groupKey:String(r.group_key),originalLoginIdentity:r.original_login_identity===true?true:undefined}));
  const candidates=(await db.query('SELECT candidates_json FROM operational_login_migration_candidates WHERE tenant_id=$1 AND workspace_id=$2',args)).rows[0];
  const row=(await db.query(`SELECT m.*,p.original_login_key,p.original_name_suffix,p.group_key,r.original_result_state_json FROM original_test_numbers m
   JOIN test_runs r ON r.test_run_id=m.test_run_id AND r.participant_session_id=m.participant_session_id AND r.tenant_id=m.tenant_id AND r.workspace_id=m.workspace_id AND r.content_release_id=m.content_release_id
   JOIN participant_sessions p ON p.participant_session_id=m.participant_session_id AND p.tenant_id=m.tenant_id AND p.workspace_id=m.workspace_id AND p.content_release_id=m.content_release_id
   WHERE m.test_number=$1 AND m.tenant_id=$2 AND m.workspace_id=$3 AND p.original_login_key IS NOT NULL AND p.original_name_suffix IS NOT NULL`,[testNumber,...args])).rows[0];
  const scope=row?{testNumber:String(row.test_number),testRunId:String(row.test_run_id),participantSessionId:String(row.participant_session_id),tenantId:String(row.tenant_id),workspaceId:String(row.workspace_id),contentReleaseId:String(row.content_release_id)}:null;
  const target=row&&scope?{scope,person:{...scope,originalLoginKey:String(row.original_login_key),originalNameSuffix:String(row.original_name_suffix),groupKey:String(row.group_key)},resultState:typeof row.original_result_state_json==='string'?JSON.parse(row.original_result_state_json):row.original_result_state_json??undefined}:null;
  const prepared=prepareOriginalMonitorSelectedLock(data,candidates?(typeof candidates.candidates_json==='string'?JSON.parse(candidates.candidates_json):candidates.candidates_json):[],actor,groupKey,testNumber,target,locked,timestamp);
  await db.query('UPDATE test_runs SET locked=$1,updated_at=$2,original_result_state_json=$3::jsonb WHERE test_run_id=$4',[locked,prepared.effect.updatedAt,JSON.stringify(prepared.effect.originalResultState),prepared.result.scope.testRunId]);
  await db.query('COMMIT');return prepared.result;
 }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
}
