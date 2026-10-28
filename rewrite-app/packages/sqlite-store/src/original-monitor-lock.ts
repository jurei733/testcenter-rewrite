import type {DatabaseSync} from 'node:sqlite';
import {assertOriginalMonitorActor,originalMonitorGroupSelection,prepareOriginalMonitorSelectedLock,type OriginalMonitorActor,type OriginalMonitorLockResult} from '@testcenter-rewrite-app/application';
import {readOriginalMonitorActorData} from './original-monitor-session.js';
import {rollbackAfterFailure} from './transaction-rollback.js';
export function changeOriginalMonitorTestLock(db:DatabaseSync,actor:OriginalMonitorActor,groupKey:string,testNumber:string,locked:boolean,timestamp:string):OriginalMonitorLockResult {
 db.exec('BEGIN IMMEDIATE');
 try {
  const data=readOriginalMonitorActorData(db,actor);assertOriginalMonitorActor(data,actor);originalMonitorGroupSelection(actor,groupKey);
  const args=[actor.tenantId,actor.workspaceId];
  data.personNumbers=db.prepare('SELECT person_number,participant_session_id,tenant_id,workspace_id,original_login_key,original_name_suffix FROM original_person_numbers WHERE participant_session_id=? AND tenant_id=? AND workspace_id=?').all(actor.participantSessionId,...args).map(r=>({personNumber:String(r.person_number),participantSessionId:String(r.participant_session_id),tenantId:String(r.tenant_id),workspaceId:String(r.workspace_id),originalLoginKey:String(r.original_login_key),originalNameSuffix:String(r.original_name_suffix)}));
  data.entries=db.prepare('SELECT tenant_id,workspace_id,login_key,group_key,original_login_identity FROM participant_roster_entries WHERE tenant_id=? AND workspace_id=?').all(...args).map(r=>({tenantId:String(r.tenant_id),workspaceId:String(r.workspace_id),loginKey:String(r.login_key),groupKey:String(r.group_key),originalLoginIdentity:r.original_login_identity===1?true:undefined}));
  const candidates=db.prepare('SELECT candidates_json FROM operational_login_migration_candidates WHERE tenant_id=? AND workspace_id=?').get(...args);
  // Select only native identity and lock clock metadata, never responses/state.
  const row=db.prepare(`SELECT m.*,p.original_login_key,p.original_name_suffix,p.group_key,r.original_result_state_json FROM original_test_numbers m
   JOIN test_runs r ON r.test_run_id=m.test_run_id AND r.participant_session_id=m.participant_session_id AND r.tenant_id=m.tenant_id AND r.workspace_id=m.workspace_id AND r.content_release_id=m.content_release_id
   JOIN participant_sessions p ON p.participant_session_id=m.participant_session_id AND p.tenant_id=m.tenant_id AND p.workspace_id=m.workspace_id AND p.content_release_id=m.content_release_id
   WHERE m.test_number=? AND m.tenant_id=? AND m.workspace_id=? AND p.original_login_key IS NOT NULL AND p.original_name_suffix IS NOT NULL`).get(testNumber,...args);
  const scope=row?{testNumber:String(row.test_number),testRunId:String(row.test_run_id),participantSessionId:String(row.participant_session_id),tenantId:String(row.tenant_id),workspaceId:String(row.workspace_id),contentReleaseId:String(row.content_release_id)}:null;
  const target=row&&scope?{scope,person:{...scope,originalLoginKey:String(row.original_login_key),originalNameSuffix:String(row.original_name_suffix),groupKey:String(row.group_key)},resultState:row.original_result_state_json==null?undefined:JSON.parse(String(row.original_result_state_json))}:null;
  const prepared=prepareOriginalMonitorSelectedLock(data,candidates?JSON.parse(String(candidates.candidates_json)):[],actor,groupKey,testNumber,target,locked,timestamp);
  db.prepare('UPDATE test_runs SET locked=?,updated_at=?,original_result_state_json=? WHERE test_run_id=?').run(locked?1:0,prepared.effect.updatedAt,JSON.stringify(prepared.effect.originalResultState),prepared.result.scope.testRunId);
  db.exec('COMMIT');return prepared.result;
 }catch(error){return rollbackAfterFailure(db,error);}
}
