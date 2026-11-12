import type {Pool} from 'pg';
import type {OriginalLoginBinding,ParticipantSession,SourcePackage,WorkspaceActivityEvent} from '@testcenter-rewrite-app/domain';
import {prepareOriginalSystemCheckEffect,type OriginalSystemCheckSelector,type OriginalSystemCheckSnapshot,type OriginalSystemCheckEffect} from '@testcenter-rewrite-app/application';
type Row=Record<string,unknown>;
type Mappers={person:(row:Row|undefined)=>ParticipantSession|null;binding:(row:Row)=>OriginalLoginBinding;
 source:(row:Row|undefined)=>SourcePackage|null;event:(row:Row|undefined)=>WorkspaceActivityEvent|null};
const present=<Value>(value:Value|null):value is Value=>value!==null;
export async function transactOriginalSystemCheck<Value>(pool:Pool,map:Mappers,selector:OriginalSystemCheckSelector,
 transform:(snapshot:OriginalSystemCheckSnapshot)=>OriginalSystemCheckEffect<Value>):Promise<Value>{
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  // Same order as private operational/asset imports, followed by the workspace
  // lock shared by physical publication. Credential SHARE locks order the write
  // against token rotation/logout, including writers in other processes.
  await client.query('SELECT pg_advisory_xact_lock(1413693779, hashtext(current_schema()))');
  const scope=[selector.tenantId,selector.workspaceId];
  const locator=(await client.query(`SELECT n.tenant_id,n.workspace_id,t.tenant_key,w.workspace_key
   FROM original_workspace_numbers n JOIN workspaces w ON w.workspace_id=n.workspace_id AND w.tenant_id=n.tenant_id JOIN tenants t ON t.tenant_id=n.tenant_id
   WHERE n.workspace_number=$1 AND n.tenant_id=$2 AND n.workspace_id=$3 AND w.status='active' AND t.status='active' FOR NO KEY UPDATE OF w FOR SHARE OF t`,[selector.workspaceNumber,...scope])).rows[0];
  const person=selector.actorId?map.person((await client.query('SELECT * FROM participant_sessions WHERE participant_session_id=$1 FOR SHARE',[selector.actorId])).rows[0]):null;
  const credential=selector.actorId?(await client.query('SELECT token_hash,updated_at FROM participant_access_credentials WHERE participant_session_id=$1 FOR SHARE',[selector.actorId])).rows[0]:undefined;
  const binding=person?.originalLoginKey?(await client.query('SELECT * FROM original_login_bindings WHERE tenant_id=$1 AND workspace_id=$2 AND login_key=$3',[...scope,person.originalLoginKey])).rows[0]:undefined;
  const operational=(await client.query('SELECT candidates_json::text AS candidates_json,native_logins_json::text AS native_logins_json FROM operational_login_migration_candidates WHERE tenant_id=$1 AND workspace_id=$2',scope)).rows[0];
  const snapshot:OriginalSystemCheckSnapshot={scope:locator?{tenantId:String(locator.tenant_id),workspaceId:String(locator.workspace_id),tenantKey:String(locator.tenant_key),workspaceKey:String(locator.workspace_key)}:null,person,
   credential:credential?{participantSessionId:selector.actorId!,tokenHash:credential.token_hash==null?null:String(credential.token_hash),updatedAt:String(credential.updated_at)}:null,binding:binding?map.binding(binding):null,
   candidates:JSON.parse(String(operational?.candidates_json??'[]')),privateLogins:JSON.parse(String(operational?.native_logins_json??'[]')),
   systemCheckLoginRequired:Boolean((await client.query("SELECT 1 FROM admin_role_assignments WHERE role='system_check' LIMIT 1")).rowCount),
   sourcePackages:(await client.query('SELECT * FROM source_packages WHERE tenant_id=$1 AND workspace_id=$2',scope)).rows.map(map.source).filter(present),
   activityEvents:(await client.query('SELECT * FROM workspace_activity_events WHERE tenant_id=$1 AND workspace_id=$2',scope)).rows.map(map.event).filter(present)};
  const effect=prepareOriginalSystemCheckEffect(selector,snapshot,transform),event=effect.event;
  if(event)await client.query(`INSERT INTO workspace_activity_events (activity_event_id,tenant_id,workspace_id,event_type,actor_id,subject_type,subject_id,occurred_at,summary,details_json)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[event.activityEventId,event.tenantId,event.workspaceId,event.eventType,event.actorId,event.subjectType,event.subjectId,event.occurredAt,event.summary,JSON.stringify(event.details)]);
  await client.query('COMMIT');return structuredClone(effect.value);
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
