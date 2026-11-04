import {deleteWorkspaceAggregateRows} from './workspace-aggregate-deletion.js';
import type {DatabaseSync} from 'node:sqlite';
import type {AdminUser, AdminSession, AdminRoleAssignment, AdminLoginAttempt, Workspace, Tenant} from '@testcenter-rewrite-app/domain';
import {validateOriginalWorkspaceDeletionEffect,validateOriginalAdminDeletionEffect,validateOriginalAdminLifecycleEffect,validateOriginalWorkspaceDirectoryEffect,originalAdministrationWorkspaceTenantKey,validateOriginalAdminRoleChanges,originalAdminMetadataAllowed,originalDirectoryModification,selectOriginalAdminIdentity, originalAdminFailureBucket, type OriginalAdminSelector, type OriginalAdminSessionSnapshot, type OriginalAdminSessionEffect} from '@testcenter-rewrite-app/application';
import {rollbackAfterFailure} from './transaction-rollback.js';

type Row = Record<string, unknown>;
type Mappers = {user: (row: Row | undefined) => AdminUser | null; session: (row: Row | undefined) => AdminSession | null;
  role: (row: Row | undefined) => AdminRoleAssignment | null; attempt: (row: Row | undefined) => AdminLoginAttempt | null;
  workspace: (row: Row | undefined) => Workspace | null; tenant: (row: Row | undefined) => Tenant | null};
const present = <T>(row: T | null): row is T => row !== null;

export function mutateOriginalAdminSession(database: DatabaseSync, map: Mappers, selector: OriginalAdminSelector,
  transform: (snapshot: OriginalAdminSessionSnapshot) => OriginalAdminSessionEffect): OriginalAdminSessionEffect {
  database.exec('BEGIN IMMEDIATE');
  try {
    const id = 'name' in selector ? selectOriginalAdminIdentity(database.prepare('SELECT admin_user_id,username FROM admin_users').all().map(row =>
      ({adminUserId: String(row.admin_user_id), username: String(row.username)})), selector.name)
      : database.prepare('SELECT admin_user_id FROM admin_sessions WHERE session_token=?').get(selector.token)?.admin_user_id;
    const user = id ? map.user(database.prepare('SELECT * FROM admin_users WHERE admin_user_id=?').get(String(id))) : null;
    const roles = user ? database.prepare('SELECT * FROM admin_role_assignments WHERE admin_user_id=? ORDER BY created_at').all(user.adminUserId).map(map.role).filter(present) : [];
    const workspaces = user ? database.prepare(`SELECT w.* FROM workspaces w WHERE EXISTS
      (SELECT 1 FROM admin_role_assignments r WHERE r.admin_user_id=? AND r.role IN ('workspace_admin','native_workspace_opaque') AND r.workspace_id=w.workspace_id AND r.tenant_id=w.tenant_id)`)
      .all(user.adminUserId).map(map.workspace).filter(present) : [];
    const tenants = workspaces.length ? database.prepare('SELECT * FROM tenants WHERE tenant_id IN (' + workspaces.map(() => '?').join(',') + ')').all(...workspaces.map(w => w.tenantId)).map(map.tenant).filter(present) : [];
    const bucket = 'name' in selector ? originalAdminFailureBucket(user?.username ?? selector.name) : '';
    const number = user ? database.prepare('SELECT * FROM original_admin_numbers WHERE admin_user_id=?').get(user.adminUserId) : null;
    const workspaceNumbers = workspaces.length ? database.prepare('SELECT * FROM original_workspace_numbers WHERE workspace_id IN (' + workspaces.map(() => '?').join(',') + ')').all(...workspaces.map(w => w.workspaceId)) : [];
    const snapshot: OriginalAdminSessionSnapshot = {user, roles, workspaces, tenants,
      sessions: user ? database.prepare('SELECT * FROM admin_sessions WHERE admin_user_id=?').all(user.adminUserId).map(map.session).filter(present) : [],
      attempt: bucket ? map.attempt(database.prepare('SELECT * FROM admin_login_attempts WHERE username=?').get(bucket)) : null,
      number: number ? {adminUserId: String(number.admin_user_id), adminNumber: String(number.admin_number)} : null,
      counter: String(database.prepare('SELECT last_number FROM original_admin_number_counter WHERE singleton=1').get()?.last_number),
      workspaceCounter: String(database.prepare('SELECT last_number FROM original_workspace_number_counter WHERE singleton=1').get()?.last_number),
      workspaceNumbers: workspaceNumbers.map(row => ({tenantId: String(row.tenant_id), workspaceId: String(row.workspace_id), workspaceNumber: String(row.workspace_number)}))};
    if('token' in selector&&originalAdminMetadataAllowed(snapshot,selector)){
      const root=roles.some(r=>r.role==='platform_admin');
      if(root&&selector.directory){
        snapshot.directory={};
        if(selector.directory==='users'||selector.directory==='rights')snapshot.directory.users=database.prepare(`SELECT u.admin_user_id,u.username,n.admin_number,
          EXISTS(SELECT 1 FROM admin_role_assignments r WHERE r.admin_user_id=u.admin_user_id AND r.role='platform_admin') AS super_admin
          FROM admin_users u LEFT JOIN original_admin_numbers n ON n.admin_user_id=u.admin_user_id`).all().map(r=>({adminUserId:String(r.admin_user_id),username:String(r.username),adminNumber:r.admin_number==null?null:String(r.admin_number),isSuperadmin:Boolean(r.super_admin)}));
        if(selector.adminWrite&&snapshot.directory.users){
          const roots=database.prepare("SELECT role_assignment_id,admin_user_id FROM admin_role_assignments WHERE role='platform_admin'").all();
          for(const user of snapshot.directory.users)user.rootRoleAssignmentIds=roots.filter(r=>r.admin_user_id===user.adminUserId).map(r=>String(r.role_assignment_id));
        }
        if(selector.directory==='workspaces'||selector.directory==='rights'){
          const ws=database.prepare(`SELECT w.* FROM workspaces w JOIN tenants t ON t.tenant_id=w.tenant_id WHERE w.status='active' AND t.status='active'`).all().map(map.workspace).filter(present);
          const metadataOnly=selector.directory==='rights'||selector.workspaceWrite;
          const files=(metadataOnly?[]:database.prepare('SELECT source_package_id,tenant_id,workspace_id,status,uploaded_at FROM source_packages').all()).map(r=>({sourcePackageId:String(r.source_package_id),tenantId:String(r.tenant_id),workspaceId:String(r.workspace_id),status:r.status as import('@testcenter-rewrite-app/domain').SourcePackageStatus,uploadedAt:String(r.uploaded_at)}));
          const events=(metadataOnly?[]:database.prepare("SELECT tenant_id,workspace_id,event_type,subject_id,details_json FROM workspace_activity_events WHERE event_type IN ('source_package_assembled','source_package_replaced')").all()).map(r=>({tenantId:String(r.tenant_id),workspaceId:String(r.workspace_id),eventType:r.event_type as import('@testcenter-rewrite-app/domain').WorkspaceActivityEvent['eventType'],subjectId:String(r.subject_id),details:JSON.parse(String(r.details_json)) as Record<string,unknown>}));
          snapshot.directory.workspaces=ws.map(w=>{const n=database.prepare('SELECT * FROM original_workspace_numbers WHERE workspace_id=?').get(w.workspaceId);if(n&&n.tenant_id!==w.tenantId)throw Error('Native workspace directory identity scope changed.');return{workspace:w,workspaceNumber:n?String(n.workspace_number):null,latestModificationAt:metadataOnly?null:originalDirectoryModification(files,events,w.tenantId,w.workspaceId)};});
          if(selector.workspaceWrite){
            const ids=[...new Set(ws.map(w=>w.tenantId))];
            snapshot.directory.tenants=ids.length?database.prepare('SELECT * FROM tenants WHERE tenant_id IN ('+ids.map(()=>'?').join(',')+')').all(...ids).map(map.tenant).filter(present):[];
            if(selector.workspaceWrite==='create')snapshot.directory.creationTenant=map.tenant(database.prepare('SELECT * FROM tenants WHERE tenant_key=?').get(originalAdministrationWorkspaceTenantKey));
          }
        }
      }
      if(root&&selector.directory==='rights'){
        const ids=snapshot.directory!.workspaces!.map(w=>w.workspace.workspaceId);
        snapshot.directory!.roles=ids.length?database.prepare("SELECT * FROM admin_role_assignments WHERE role IN ('workspace_admin','native_workspace_opaque') AND group_key IS NULL AND workspace_id IN ("+ids.map(()=>'?').join(',')+")").all(...ids).map(map.role).filter(present):[];
      }
      if(selector.targetAdminNumber!==undefined){
        const n=database.prepare('SELECT * FROM original_admin_numbers WHERE admin_number=?').get(selector.targetAdminNumber);
        const target=n&&(root||n.admin_user_id===user!.adminUserId)?map.user(database.prepare('SELECT * FROM admin_users WHERE admin_user_id=?').get(String(n.admin_user_id))):null;
        if(n&&target)snapshot.target={user:target,number:{adminUserId:target.adminUserId,adminNumber:String(n.admin_number)},sessions:database.prepare('SELECT * FROM admin_sessions WHERE admin_user_id=?').all(target.adminUserId).map(map.session).filter(present)};
      }
    }
    const effect = transform(structuredClone(snapshot));
    validateOriginalAdminRoleChanges(snapshot,effect,selector);
    validateOriginalWorkspaceDirectoryEffect(snapshot,effect,selector);
    validateOriginalAdminLifecycleEffect(snapshot,effect,selector);
    validateOriginalAdminDeletionEffect(snapshot,effect,selector);
    validateOriginalWorkspaceDeletionEffect(snapshot,effect,selector);
    for(const target of effect.deletedWorkspaces??[])deleteWorkspaceAggregateRows(database,target.workspace);
    for(const user of effect.deletedUsers??[]){
      database.prepare('DELETE FROM admin_role_assignments WHERE admin_user_id=?').run(user.adminUserId);
      database.prepare('DELETE FROM admin_sessions WHERE admin_user_id=?').run(user.adminUserId);
      if(Number(database.prepare('DELETE FROM original_admin_numbers WHERE admin_user_id=? AND admin_number=?').run(user.adminUserId,user.adminNumber).changes)!==1)throw Error('Native user deletion identity changed.');
      if(Number(database.prepare('DELETE FROM admin_users WHERE admin_user_id=?').run(user.adminUserId).changes)!==1)throw Error('Native user deletion target changed.');
    }
    if(effect.rootRoleChange){
      const c=effect.rootRoleChange;
      for(const id of c.removeIds){const changed=database.prepare("DELETE FROM admin_role_assignments WHERE role_assignment_id=? AND admin_user_id=? AND role='platform_admin'").run(id,c.adminUserId);if(Number(changed.changes)!==1)throw Error('Native Root removal identity changed.');}
      if(c.assignment){const r=c.assignment;database.prepare('INSERT INTO admin_role_assignments(role_assignment_id,admin_user_id,role,access_mode,tenant_id,workspace_id,group_key,monitor_profiles_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
        .run(r.roleAssignmentId,r.adminUserId,r.role,r.accessMode,null,null,null,JSON.stringify({monitorProfiles:[],monitorBookletVisibility:'visible'}),r.createdAt);}
    }
    if(effect.workspaceChange){
      const c=effect.workspaceChange,w=c.workspace,t=c.tenant;
      if(c.kind==='create'){
        if(database.prepare('SELECT 1 FROM workspaces WHERE workspace_id=? OR workspace_key=?').get(w.workspaceId,w.workspaceKey))throw Error('Native workspace creation identity collision.');
        if(c.createTenant)database.prepare('INSERT INTO tenants(tenant_id,tenant_key,display_name,status,created_at) VALUES(?,?,?,?,?)').run(t.tenantId,t.tenantKey,t.displayName,t.status,t.createdAt);
        database.prepare('INSERT INTO workspaces(workspace_id,tenant_id,tenant_key,workspace_key,display_name,status,created_at) VALUES(?,?,?,?,?,?,?)').run(w.workspaceId,w.tenantId,t.tenantKey,w.workspaceKey,w.displayName,w.status,w.createdAt);
      }else{
        const changed=database.prepare("UPDATE workspaces SET display_name=? WHERE workspace_id=? AND tenant_id=? AND status='active'").run(w.displayName,w.workspaceId,w.tenantId);
        if(Number(changed.changes)!==1)throw Error('Native workspace rename scope changed.');
      }
    }
    if (effect.user) database.prepare('UPDATE admin_users SET first_signed_in_at=?,password_hash=?,password_change_required=? WHERE admin_user_id=?').run(effect.user.firstSignedInAt,effect.user.passwordHash,effect.user.passwordChangeRequired?1:0,effect.user.adminUserId);
    if(effect.targetUser){if(effect.targetUser.adminUserId!==snapshot.target?.user.adminUserId)throw Error('Native target administrator scope changed.');database.prepare('UPDATE admin_users SET password_hash=?,password_change_required=? WHERE admin_user_id=?').run(effect.targetUser.passwordHash,effect.targetUser.passwordChangeRequired?1:0,effect.targetUser.adminUserId);}
    if(effect.createdUser){const u=effect.createdUser;database.prepare('INSERT INTO admin_users(admin_user_id,username,display_name,password_hash,password_change_required,status,custom_texts_json,valid_from,valid_to,valid_for_minutes,first_signed_in_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(u.adminUserId,u.username,u.displayName,u.passwordHash,u.passwordChangeRequired?1:0,u.status,JSON.stringify(u.customTexts),u.validFrom,u.validTo,u.validForMinutes,u.firstSignedInAt,u.createdAt);}
    if (effect.attempt) {
      const a = effect.attempt;
      database.prepare(`INSERT INTO admin_login_attempts(username,failed_attempts,expires_at,updated_at) VALUES(?,?,?,?)
        ON CONFLICT(username) DO UPDATE SET failed_attempts=excluded.failed_attempts,expires_at=excluded.expires_at,updated_at=excluded.updated_at`)
        .run(a.username, a.failedAttempts, a.expiresAt, a.updatedAt);
    }
    for (const s of [...effect.sessions??[],...effect.targetSessions??[]]) {
      if (!user || !(s.adminUserId===user.adminUserId||s.adminUserId===snapshot.target?.user.adminUserId)) throw Error('Native administrator session scope changed.');
      const insertion=database.prepare(`INSERT INTO admin_sessions(admin_session_id,admin_user_id,session_token,created_at,expires_at,revoked_at) VALUES(?,?,?,?,?,?)
        ON CONFLICT(admin_session_id) DO UPDATE SET expires_at=excluded.expires_at,revoked_at=excluded.revoked_at WHERE admin_sessions.admin_user_id=excluded.admin_user_id AND admin_sessions.session_token=excluded.session_token`)
        .run(s.adminSessionId, s.adminUserId, s.token, s.createdAt, s.expiresAt, s.revokedAt);
      if(Number(insertion.changes)!==1)throw Error('Native administrator session identity collision.');
    }
    for(const n of [...effect.adminNumbers??[],...effect.number?[effect.number]:[]])database.prepare('INSERT INTO original_admin_numbers(admin_number,admin_user_id) VALUES(?,?) ON CONFLICT(admin_user_id) DO NOTHING').run(n.adminNumber,n.adminUserId);
    if (effect.counter !== undefined) database.prepare('UPDATE original_admin_number_counter SET last_number=? WHERE singleton=1').run(effect.counter);
    for (const n of effect.workspaceNumbers ?? []) database.prepare('INSERT INTO original_workspace_numbers(workspace_number,workspace_id,tenant_id) VALUES(?,?,?)').run(n.workspaceNumber, n.workspaceId, n.tenantId);
    if (effect.workspaceCounter !== undefined) database.prepare('UPDATE original_workspace_number_counter SET last_number=? WHERE singleton=1').run(effect.workspaceCounter);
    for(const roleId of effect.roleChanges?.removeIds??[])database.prepare("DELETE FROM admin_role_assignments WHERE role_assignment_id=? AND role IN ('workspace_admin','native_workspace_opaque') AND group_key IS NULL").run(roleId);
    for(const r of effect.roleChanges?.assignments??[]){
      const changed=database.prepare(`INSERT INTO admin_role_assignments(role_assignment_id,admin_user_id,role,access_mode,tenant_id,workspace_id,group_key,monitor_profiles_json,created_at)
        VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(role_assignment_id) DO UPDATE SET role=excluded.role,access_mode=excluded.access_mode,monitor_profiles_json=excluded.monitor_profiles_json
        WHERE admin_role_assignments.role IN ('workspace_admin','native_workspace_opaque') AND admin_role_assignments.group_key IS NULL
          AND admin_role_assignments.admin_user_id=excluded.admin_user_id AND admin_role_assignments.tenant_id=excluded.tenant_id AND admin_role_assignments.workspace_id=excluded.workspace_id`).run(
          r.roleAssignmentId,r.adminUserId,r.role,r.accessMode,r.tenantId,r.workspaceId,r.groupKey,JSON.stringify({monitorProfiles:r.monitorProfiles,monitorBookletVisibility:r.monitorBookletVisibility,...r.role==='native_workspace_opaque'?{nativeWorkspaceRole:r.nativeWorkspaceRole}:{}}),r.createdAt);
      if(Number(changed.changes)!==1)throw Error('Native permission identity collision.');
    }
    for(const a of [...(effect.audit?[effect.audit]:[]),...(effect.audits??[])]) {
      database.prepare('INSERT INTO admin_audit_events(admin_audit_event_id,event_type,actor_admin_user_id,subject_admin_user_id,occurred_at,summary,details_json) VALUES(?,?,?,?,?,?,?)')
        .run(a.adminAuditEventId, a.eventType, a.actorAdminUserId, a.subjectAdminUserId, a.occurredAt, a.summary, JSON.stringify(a.details));
    }
    database.exec('COMMIT');
    return effect;
  } catch (error) { return rollbackAfterFailure(database, error); }
}
