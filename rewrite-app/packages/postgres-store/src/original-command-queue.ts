import type {Pool,PoolClient} from 'pg';
import {assertOriginalCommandActorMetadata,assertOriginalCommandPacket,assertOriginalTestLogInput,selectOriginalCommands,prepareOriginalCommandPolling,originalParticipantGroupKeysEqual,resultParentUnavailable,type OriginalCommandActor,type OriginalCommandRepository,type OriginalCommandDelivery,type OriginalTestNumberRecord} from '@testcenter-rewrite-app/application';
import {guardResultArtifactBatch,withResultArtifactParent} from './result-artifact-parent.js';

async function actor(db:Pool|PoolClient,input:OriginalCommandActor):Promise<void>{
 const row=(await db.query(`SELECT p.participant_session_id,p.tenant_id,p.workspace_id,p.original_login_key,p.original_name_suffix,p.group_key,b.group_key AS binding_group,w.status AS workspace_status,t.status AS tenant_status,c.native_logins_json
 FROM participant_sessions p JOIN workspaces w ON w.workspace_id=p.workspace_id AND w.tenant_id=p.tenant_id JOIN tenants t ON t.tenant_id=p.tenant_id
 JOIN original_login_bindings b ON b.tenant_id=p.tenant_id AND b.workspace_id=p.workspace_id AND b.login_key=p.original_login_key
 LEFT JOIN operational_login_migration_candidates c ON c.tenant_id=p.tenant_id AND c.workspace_id=p.workspace_id WHERE p.participant_session_id=$1`,[input.participantSessionId])).rows[0];
 const logins=row?.native_logins_json;
 assertOriginalCommandActorMetadata(input,row?{participantSessionId:String(row.participant_session_id),tenantId:String(row.tenant_id),workspaceId:String(row.workspace_id),originalLoginKey:row.original_login_key??undefined,originalNameSuffix:row.original_name_suffix??undefined,groupKey:String(row.group_key),bindingGroupKey:String(row.binding_group),enabled:row.workspace_status==='active'&&row.tenant_status==='active'&&Array.isArray(logins)&&logins.some(l=>l.loginKey===input.originalLoginKey&&l.loginMode==='monitor-group')}:null);
}
async function target(db:Pool|PoolClient,input:OriginalCommandActor,testNumber:string):Promise<OriginalTestNumberRecord|null>{
 const r=(await db.query(`SELECT m.*,p.group_key,b.group_key AS binding_group FROM original_test_numbers m
 JOIN test_runs t ON t.test_run_id=m.test_run_id AND t.participant_session_id=m.participant_session_id AND t.tenant_id=m.tenant_id AND t.workspace_id=m.workspace_id AND t.content_release_id=m.content_release_id
 JOIN participant_sessions p ON p.participant_session_id=m.participant_session_id AND p.tenant_id=m.tenant_id AND p.workspace_id=m.workspace_id AND p.content_release_id=m.content_release_id
 JOIN original_login_bindings b ON b.tenant_id=p.tenant_id AND b.workspace_id=p.workspace_id AND b.login_key=p.original_login_key
 WHERE m.test_number=$1 AND m.tenant_id=$2 AND m.workspace_id=$3 AND p.original_name_suffix IS NOT NULL`,[testNumber,input.tenantId,input.workspaceId])).rows[0];
 if(!r||!originalParticipantGroupKeysEqual(String(r.group_key),input.groupKey)||!originalParticipantGroupKeysEqual(String(r.binding_group),input.groupKey))return null;
 return{testNumber:String(r.test_number),testRunId:String(r.test_run_id),participantSessionId:String(r.participant_session_id),tenantId:String(r.tenant_id),workspaceId:String(r.workspace_id),contentReleaseId:String(r.content_release_id)};
}
async function owner(client:PoolClient,input:OriginalTestNumberRecord):Promise<void>{
 assertOriginalTestLogInput(input);
 const r=await client.query(`SELECT 1 FROM original_test_numbers m JOIN test_runs t ON t.test_run_id=m.test_run_id AND t.participant_session_id=m.participant_session_id AND t.tenant_id=m.tenant_id AND t.workspace_id=m.workspace_id AND t.content_release_id=m.content_release_id
 JOIN participant_sessions p ON p.participant_session_id=m.participant_session_id AND p.tenant_id=m.tenant_id AND p.workspace_id=m.workspace_id AND p.content_release_id=m.content_release_id
 WHERE m.test_number=$1 AND m.test_run_id=$2 AND m.participant_session_id=$3 AND m.tenant_id=$4 AND m.workspace_id=$5 AND m.content_release_id=$6 AND p.original_login_key IS NOT NULL AND p.original_name_suffix IS NOT NULL`,[input.testNumber,input.testRunId,input.participantSessionId,input.tenantId,input.workspaceId,input.contentReleaseId]);if(!r.rowCount)throw resultParentUnavailable();
}
export function createOriginalCommandRepository(pool:Pool):OriginalCommandRepository{return{
 async reserveOriginalCommandNumber(){return String((await pool.query("SELECT nextval(pg_get_serial_sequence('original_native_commands','command_number'))::text AS number")).rows[0].number);},
 async findOriginalCommandTarget(input,testNumber){await actor(pool,input);return target(pool,input,testNumber);},
 async appendOriginalCommand(input,command,targets){const client=await pool.connect();try{
  await client.query('BEGIN');await client.query('SELECT workspace_id FROM workspaces WHERE tenant_id=$1 AND workspace_id=$2 FOR NO KEY UPDATE',[input.tenantId,input.workspaceId]);await actor(client,input);await guardResultArtifactBatch(client,targets);assertOriginalCommandPacket(command);
  const last=(await client.query("SELECT pg_sequence_last_value(pg_get_serial_sequence('original_native_commands','command_number')::regclass)::text AS value")).rows[0]?.value;
  if(!last||BigInt(command.id)>BigInt(last)||!targets.length||new Set(targets.map(t=>t.testNumber)).size!==targets.length||(await client.query('SELECT 1 FROM original_native_commands WHERE command_number=$1 LIMIT 1',[command.id])).rowCount)throw new Error('Native command allocation or batch identity is invalid.');
  for(const t of targets){const current=await target(client,input,t.testNumber);if(!current||(['testRunId','participantSessionId','tenantId','workspaceId','contentReleaseId']as const).some(k=>current[k]!==t[k]))throw resultParentUnavailable();}
  for(const t of targets)await client.query(`INSERT INTO original_native_commands(command_number,test_number,test_run_id,participant_session_id,tenant_id,workspace_id,content_release_id,commander_participant_session_id,keyword,arguments_json,timestamp_seconds,executed) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,FALSE)`,[command.id,t.testNumber,t.testRunId,t.participantSessionId,t.tenantId,t.workspaceId,t.contentReleaseId,input.participantSessionId,command.keyword,JSON.stringify(command.arguments),command.timestamp]);
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}},
 async listOriginalCommands(input,lastCommandId){return withResultArtifactParent(pool,input,async client=>{await owner(client,input);const rows=(await client.query('SELECT command_number::text AS id,keyword,arguments_json,timestamp_seconds::text AS timestamp,executed FROM original_native_commands WHERE test_number=$1 ORDER BY timestamp_seconds,command_number',[input.testNumber])).rows;return selectOriginalCommands(rows.map(row=>({id:String(row.id),keyword:String(row.keyword),arguments:row.arguments_json,timestamp:String(row.timestamp),executed:row.executed} as OriginalCommandDelivery)),lastCommandId);});},
 async acknowledgeOriginalCommand(input,number){return withResultArtifactParent(pool,input,async client=>{await owner(client,input);const row=(await client.query('SELECT executed FROM original_native_commands WHERE test_number=$1 AND command_number=$2 FOR UPDATE',[input.testNumber,number])).rows[0];if(!row)return null;if(row.executed)return'already';await client.query('UPDATE original_native_commands SET executed=TRUE WHERE test_number=$1 AND command_number=$2',[input.testNumber,number]);return'executed';});},
 async touchOriginalCommandPolling(input,timestamp){return withResultArtifactParent(pool,input,async client=>{await owner(client,input);const row=(await client.query('SELECT original_test_state_json,original_result_state_json FROM test_runs WHERE test_run_id=$1',[input.testRunId])).rows[0];const effect=prepareOriginalCommandPolling(timestamp,typeof row.original_test_state_json==='string'?JSON.parse(row.original_test_state_json):row.original_test_state_json??undefined,typeof row.original_result_state_json==='string'?JSON.parse(row.original_result_state_json):row.original_result_state_json??undefined);if(!effect)return false;await client.query('UPDATE test_runs SET updated_at=$1,original_result_state_json=$2::jsonb WHERE test_run_id=$3',[effect.updatedAt,JSON.stringify(effect.originalResultState),input.testRunId]);return true;},true);}
};}
