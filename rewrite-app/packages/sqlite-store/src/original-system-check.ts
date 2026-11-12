import type {DatabaseSync} from 'node:sqlite';
import type {OriginalLoginBinding,ParticipantSession,SourcePackage,WorkspaceActivityEvent} from '@testcenter-rewrite-app/domain';
import {prepareOriginalSystemCheckEffect,type OriginalSystemCheckSelector,type OriginalSystemCheckSnapshot,type OriginalSystemCheckEffect} from '@testcenter-rewrite-app/application';
type Row=Record<string,unknown>;
type Mappers={person:(row:Row|undefined)=>ParticipantSession|null;binding:(row:Row)=>OriginalLoginBinding;
 source:(row:Row|undefined)=>SourcePackage|null;event:(row:Row|undefined)=>WorkspaceActivityEvent|null};
const present=<Value>(value:Value|null):value is Value=>value!==null;
export function transactOriginalSystemCheck<Value>(database:DatabaseSync,map:Mappers,selector:OriginalSystemCheckSelector,
 transform:(snapshot:OriginalSystemCheckSnapshot)=>OriginalSystemCheckEffect<Value>):Value{
 database.exec('BEGIN IMMEDIATE');
 try{
  const scope=[selector.tenantId,selector.workspaceId],locator=database.prepare(`SELECT n.tenant_id,n.workspace_id,t.tenant_key,w.workspace_key
   FROM original_workspace_numbers n JOIN workspaces w ON w.workspace_id=n.workspace_id AND w.tenant_id=n.tenant_id JOIN tenants t ON t.tenant_id=n.tenant_id
   WHERE n.workspace_number=? AND n.tenant_id=? AND n.workspace_id=? AND w.status='active' AND t.status='active'`).get(selector.workspaceNumber,...scope);
  const person=selector.actorId?map.person(database.prepare('SELECT * FROM participant_sessions WHERE participant_session_id=?').get(selector.actorId)):null;
  const credential=selector.actorId?database.prepare('SELECT token_hash,updated_at FROM participant_access_credentials WHERE participant_session_id=?').get(selector.actorId):undefined;
  const binding=person?.originalLoginKey?database.prepare('SELECT * FROM original_login_bindings WHERE tenant_id=? AND workspace_id=? AND login_key=?').get(...scope,person.originalLoginKey):undefined;
  const operational=database.prepare('SELECT candidates_json,native_logins_json FROM operational_login_migration_candidates WHERE tenant_id=? AND workspace_id=?').get(...scope);
  const snapshot:OriginalSystemCheckSnapshot={scope:locator?{tenantId:String(locator.tenant_id),workspaceId:String(locator.workspace_id),tenantKey:String(locator.tenant_key),workspaceKey:String(locator.workspace_key)}:null,person,
   credential:credential?{participantSessionId:selector.actorId!,tokenHash:credential.token_hash==null?null:String(credential.token_hash),updatedAt:String(credential.updated_at)}:null,binding:binding?map.binding(binding):null,
   candidates:JSON.parse(String(operational?.candidates_json??'[]')),privateLogins:JSON.parse(String(operational?.native_logins_json??'[]')),
   systemCheckLoginRequired:Boolean(database.prepare("SELECT 1 FROM admin_role_assignments WHERE role='system_check' LIMIT 1").get()),
   sourcePackages:database.prepare('SELECT * FROM source_packages WHERE tenant_id=? AND workspace_id=?').all(...scope).map(map.source).filter(present),
   activityEvents:database.prepare('SELECT * FROM workspace_activity_events WHERE tenant_id=? AND workspace_id=?').all(...scope).map(map.event).filter(present)};
  const effect=prepareOriginalSystemCheckEffect(selector,snapshot,transform),event=effect.event;
  if(event)database.prepare(`INSERT INTO workspace_activity_events (activity_event_id,tenant_id,workspace_id,event_type,actor_id,subject_type,subject_id,occurred_at,summary,details_json)
   VALUES (?,?,?,?,?,?,?,?,?,?)`).run(event.activityEventId,event.tenantId,event.workspaceId,event.eventType,event.actorId,event.subjectType,event.subjectId,event.occurredAt,event.summary,JSON.stringify(event.details));
  database.exec('COMMIT');return structuredClone(effect.value);
 }catch(error){database.exec('ROLLBACK');throw error;}
}
