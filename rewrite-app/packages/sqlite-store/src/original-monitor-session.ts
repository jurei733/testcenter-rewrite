import type {DatabaseSync} from 'node:sqlite';
import {rollbackAfterFailure} from './transaction-rollback.js';
import {assertOriginalMonitorActor,selectOriginalMonitorSessions,originalMonitorGroupSelection,originalMonitorable,originalParticipantGroupKeysEqual,type OriginalMonitorData,type OriginalMonitorActor,type OriginalMonitorRepository,type OriginalMonitorPacket} from '@testcenter-rewrite-app/application';
type Row=Record<string,unknown>;
const decode=(value:unknown):any=>value==null?undefined:typeof value==='string'?JSON.parse(value):value;
const text=(value:unknown):string|undefined=>value==null?undefined:String(value);
function person(row:Row):OriginalMonitorData['people'][number]{return {participantSessionId:String(row.participant_session_id),tenantId:String(row.tenant_id),workspaceId:String(row.workspace_id),contentReleaseId:row.content_release_id==null?null:String(row.content_release_id),groupKey:String(row.group_key),originalLoginKey:text(row.original_login_key),originalNameSuffix:text(row.original_name_suffix),originalOperationalMode:text(row.original_operational_mode) as OriginalMonitorData['people'][number]['originalOperationalMode']};}
const personColumns='p.participant_session_id,p.tenant_id,p.workspace_id,p.content_release_id,p.group_key,p.original_login_key,p.original_name_suffix,p.original_operational_mode';
function readSnapshot(db:DatabaseSync,actor:OriginalMonitorActor,requested?:string):OriginalMonitorPacket[]{
 const q=(sql:string,args:string[]=[]):Row[]=>db.prepare(sql).all(...args);
 const scope=[actor.tenantId,actor.workspaceId];
 const tenant=q('SELECT status FROM tenants WHERE tenant_id=?',[actor.tenantId]);
 const workspace=q('SELECT status FROM workspaces WHERE tenant_id=? AND workspace_id=?',scope);
 const privateRow=(q('SELECT native_logins_json FROM operational_login_migration_candidates WHERE tenant_id=? AND workspace_id=?',scope))[0];
 const bindings=(q('SELECT tenant_id,workspace_id,login_key,group_key,group_snapshot_key,created_at,last_authenticated_at FROM original_login_bindings WHERE tenant_id=? AND workspace_id=?',scope)).map(row=>({tenantId:String(row.tenant_id),workspaceId:String(row.workspace_id),loginKey:String(row.login_key),groupKey:String(row.group_key),groupSnapshotKey:String(row.group_snapshot_key),createdAt:String(row.created_at),lastAuthenticatedAt:String(row.last_authenticated_at)}));
 const data:OriginalMonitorData={scope:actor,tenantActive:tenant[0]?.status==='active',workspaceActive:workspace[0]?.status==='active',
  people:(q('SELECT '+personColumns+' FROM participant_sessions p WHERE p.participant_session_id=? AND p.tenant_id=? AND p.workspace_id=?',[actor.participantSessionId,...scope])).map(person),
  bindings,operationalLogins:decode(privateRow?.native_logins_json)??[],entries:[],runs:[],units:[],personNumbers:[],testNumbers:[]};
 assertOriginalMonitorActor(data,actor);
 const selected=originalMonitorGroupSelection(actor,requested);if(selected===null)return[];
 data.entries=(q('SELECT tenant_id,workspace_id,login_key,group_key,group_label,execution_mode,original_login_identity FROM participant_roster_entries WHERE tenant_id=? AND workspace_id=?',scope)).map(row=>({tenantId:String(row.tenant_id),workspaceId:String(row.workspace_id),loginKey:String(row.login_key),groupKey:String(row.group_key),groupLabel:text(row.group_label),executionMode:text(row.execution_mode) as OriginalMonitorData['entries'][number]['executionMode'],originalLoginIdentity:row.original_login_identity===true||row.original_login_identity===1?true:undefined}));
 const groups=selected===undefined?[]:[...new Set(data.entries.filter(entry=>originalMonitorable(entry)&&originalParticipantGroupKeysEqual(entry.groupKey,selected)).map(entry=>entry.groupKey))];
 if(selected!==undefined&&!groups.length)return[];
 const groupFilter=selected===undefined?'':' AND e.group_key IN ('+groups.map(()=>'?').join(',')+')';
 const join=` JOIN participant_sessions p ON p.participant_session_id=r.participant_session_id AND p.tenant_id=r.tenant_id AND p.workspace_id=r.workspace_id
  JOIN participant_roster_entries e ON e.tenant_id=p.tenant_id AND e.workspace_id=p.workspace_id AND e.login_key=p.original_login_key
  WHERE r.tenant_id=? AND r.workspace_id=? AND e.original_login_identity=TRUE AND e.execution_mode IN ('run-hot-return','run-hot-restart','run-trial')`+groupFilter;
 const args=[...scope,...groups];
 data.people=(q('SELECT '+personColumns+' FROM participant_sessions p WHERE p.tenant_id=? AND p.workspace_id=?',scope)).map(person);
 data.runs=(q('SELECT r.test_run_id,r.participant_session_id,r.tenant_id,r.workspace_id,r.content_release_id,r.locked,r.original_result_state_json,r.original_test_state_json FROM test_runs r'+join,args)).map(row=>({testRunId:String(row.test_run_id),participantSessionId:String(row.participant_session_id),tenantId:String(row.tenant_id),workspaceId:String(row.workspace_id),contentReleaseId:String(row.content_release_id),locked:row.locked===true||row.locked===1,originalResultState:decode(row.original_result_state_json),originalTestState:decode(row.original_test_state_json)}));
 // Extract state inside SQL. Full native unit_json includes private response
 // parts and must never enter the monitor's application-side JSON decoder.
 data.units=(q(`SELECT u.test_run_id,u.participant_session_id,u.tenant_id,u.workspace_id,u.content_release_id,u.unit_name,json_extract(u.unit_json,'$.state') AS state_json,json_extract(u.unit_json,'$.unknownHistory') AS unknown_history FROM original_native_units u JOIN test_runs r ON r.test_run_id=u.test_run_id`+join,args)).map(row=>({testRunId:String(row.test_run_id),participantSessionId:String(row.participant_session_id),tenantId:String(row.tenant_id),workspaceId:String(row.workspace_id),contentReleaseId:String(row.content_release_id),unitName:String(row.unit_name),state:decode(row.state_json),unknownHistory:row.unknown_history===true||row.unknown_history===1||row.unknown_history==='true'?true:undefined}));
 data.personNumbers=(q('SELECT person_number,participant_session_id,tenant_id,workspace_id,original_login_key,original_name_suffix FROM original_person_numbers WHERE tenant_id=? AND workspace_id=?',scope)).map(row=>({personNumber:String(row.person_number),participantSessionId:String(row.participant_session_id),tenantId:String(row.tenant_id),workspaceId:String(row.workspace_id),originalLoginKey:String(row.original_login_key),originalNameSuffix:String(row.original_name_suffix)}));
 data.testNumbers=(q('SELECT test_number,test_run_id,participant_session_id,tenant_id,workspace_id,content_release_id FROM original_test_numbers WHERE tenant_id=? AND workspace_id=?',scope)).map(row=>({testNumber:String(row.test_number),testRunId:String(row.test_run_id),participantSessionId:String(row.participant_session_id),tenantId:String(row.tenant_id),workspaceId:String(row.workspace_id),contentReleaseId:String(row.content_release_id)}));
 return selectOriginalMonitorSessions(data,actor,requested);
}

export function createOriginalMonitorRepository(db:DatabaseSync):OriginalMonitorRepository{return{async readOriginalMonitorSessions(actor,groupKey){db.exec('BEGIN');try{const packets=readSnapshot(db,actor,groupKey);db.exec('COMMIT');return packets;}catch(error){return rollbackAfterFailure(db,error);}}};}
