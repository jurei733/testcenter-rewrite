import type {Pool} from 'pg';
import {setTimeout} from 'node:timers/promises';
import type {AdminUser, AdminSession, AdminRoleAssignment, AdminLoginAttempt, Workspace, Tenant} from '@testcenter-rewrite-app/domain';
import {validateOriginalAdminDeletionEffect,validateOriginalAdminLifecycleEffect,validateOriginalWorkspaceDirectoryEffect,originalAdministrationWorkspaceTenantKey,validateOriginalAdminRoleChanges,originalAdminMetadataAllowed,originalDirectoryModification,selectOriginalAdminIdentity, originalAdminFailureBucket, type OriginalAdminSelector, type OriginalAdminSessionSnapshot, type OriginalAdminSessionEffect} from '@testcenter-rewrite-app/application';

type Row = Record<string, unknown>;
type Mappers = {user: (row: Row | undefined) => AdminUser | null; session: (row: Row | undefined) => AdminSession | null;
  role: (row: Row | undefined) => AdminRoleAssignment | null; attempt: (row: Row | undefined) => AdminLoginAttempt | null;
  workspace: (row: Row | undefined) => Workspace | null; tenant: (row: Row | undefined) => Tenant | null};
const present = <T>(row: T | null): row is T => row !== null;

export async function mutateOriginalAdminSession(pool: Pool, map: Mappers, selector: OriginalAdminSelector,
  transform: (snapshot: OriginalAdminSessionSnapshot) => OriginalAdminSessionEffect): Promise<OriginalAdminSessionEffect> {
  // A waiting REPEATABLE READ writer may have an old snapshot. Restart the
  // complete transaction on serialization/deadlock, never replay a partial effect.
  for (let attempt = 0; ; attempt++) {
    const client = await pool.connect();
    try {
      const rightsWrite='token' in selector&&selector.directory==='rights'&&selector.rightsWrite;
      const workspaceWrite='token' in selector&&selector.directory==='workspaces'&&selector.workspaceWrite;
      const adminWrite='token' in selector&&selector.directory==='users'&&selector.adminWrite;
      // Complete grant-set replacement must include committed insertions, not
      // an RR phantom from before a counter wait. Serialize role writers after
      // that wait, then read current rows under READ COMMITTED. Actor/session
      // and catalog parent locks remain held through grants plus audit commit.
      await client.query(rightsWrite||workspaceWrite||adminWrite?'BEGIN ISOLATION LEVEL READ COMMITTED':'BEGIN ISOLATION LEVEL REPEATABLE READ');
      const counter = (await client.query('SELECT last_number FROM original_admin_number_counter WHERE singleton=1 FOR UPDATE')).rows[0];
      // Serialize canonical tenant/catalog writes before reading native name
      // conflicts and parents. READ COMMITTED observes any writer that just
      // released these locks; Root grants remain fixed through audit commit.
      if(adminWrite)await client.query('LOCK TABLE admin_users,admin_role_assignments IN SHARE ROW EXCLUSIVE MODE');
      else if(workspaceWrite)await client.query('LOCK TABLE tenants,workspaces,admin_role_assignments IN SHARE ROW EXCLUSIVE MODE');
      else if(rightsWrite)await client.query('LOCK TABLE admin_role_assignments IN SHARE ROW EXCLUSIVE MODE');
      const id = 'name' in selector ? selectOriginalAdminIdentity((await client.query('SELECT admin_user_id,username FROM admin_users')).rows.map(row =>
        ({adminUserId: String(row.admin_user_id), username: String(row.username)})), selector.name)
        : (await client.query('SELECT admin_user_id FROM admin_sessions WHERE session_token=$1', [selector.token])).rows[0]?.admin_user_id;
      const user = id ? map.user((await client.query('SELECT * FROM admin_users WHERE admin_user_id=$1 FOR UPDATE', [id])).rows[0]) : null;
      // A grant changed after the RR snapshot must cause40001 and a complete
      // retry, rather than authorize a post-wait effect from its old Root row.
      // The selected grants stay locked until every effect/audit commits.
      const roles = user ? (await client.query('SELECT * FROM admin_role_assignments WHERE admin_user_id=$1 ORDER BY created_at FOR SHARE', [user.adminUserId])).rows.map(map.role).filter(present) : [];
      const workspaces = user ? (await client.query(`SELECT w.* FROM workspaces w WHERE EXISTS
        (SELECT 1 FROM admin_role_assignments r WHERE r.admin_user_id=$1 AND r.role IN ('workspace_admin','native_workspace_opaque') AND r.workspace_id=w.workspace_id AND r.tenant_id=w.tenant_id)`, [user.adminUserId])).rows.map(map.workspace).filter(present) : [];
      const tenants = workspaces.length ? (await client.query('SELECT * FROM tenants WHERE tenant_id=ANY($1::text[])', [workspaces.map(w => w.tenantId)])).rows.map(map.tenant).filter(present) : [];
      const bucket = 'name' in selector ? originalAdminFailureBucket(user?.username ?? selector.name) : '';
      const number = user ? (await client.query('SELECT * FROM original_admin_numbers WHERE admin_user_id=$1', [user.adminUserId])).rows[0] : null;
      const workspaceNumbers = workspaces.length ? (await client.query('SELECT * FROM original_workspace_numbers WHERE workspace_id=ANY($1::text[])', [workspaces.map(w => w.workspaceId)])).rows : [];
      const workspaceCounter = (await client.query('SELECT last_number FROM original_workspace_number_counter WHERE singleton=1 FOR UPDATE')).rows[0];
      const snapshot: OriginalAdminSessionSnapshot = {user, roles, workspaces, tenants,
        sessions: user ? (await client.query('SELECT * FROM admin_sessions WHERE admin_user_id=$1 FOR UPDATE', [user.adminUserId])).rows.map(map.session).filter(present) : [],
        attempt: bucket ? map.attempt((await client.query('SELECT * FROM admin_login_attempts WHERE username=$1 FOR UPDATE', [bucket])).rows[0]) : null,
        number: number ? {adminUserId: String(number.admin_user_id), adminNumber: String(number.admin_number)} : null, counter: String(counter?.last_number),
        workspaceCounter: String(workspaceCounter?.last_number), workspaceNumbers: workspaceNumbers.map(row => ({tenantId: String(row.tenant_id), workspaceId: String(row.workspace_id), workspaceNumber: String(row.workspace_number)}))};
      if('token' in selector&&originalAdminMetadataAllowed(snapshot,selector)){
        const root=roles.some(r=>r.role==='platform_admin');
        if(root&&selector.directory){
          snapshot.directory={};
          if(selector.directory==='users'||selector.directory==='rights')snapshot.directory.users=(await client.query(`SELECT u.admin_user_id,u.username,n.admin_number,
            EXISTS(SELECT 1 FROM admin_role_assignments r WHERE r.admin_user_id=u.admin_user_id AND r.role='platform_admin') AS super_admin
            FROM admin_users u LEFT JOIN original_admin_numbers n ON n.admin_user_id=u.admin_user_id`)).rows.map(r=>({adminUserId:String(r.admin_user_id),username:String(r.username),adminNumber:r.admin_number==null?null:String(r.admin_number),isSuperadmin:Boolean(r.super_admin)}));
          if(adminWrite&&snapshot.directory.users){
            const roots=(await client.query("SELECT role_assignment_id,admin_user_id FROM admin_role_assignments WHERE role='platform_admin'")).rows;
            for(const user of snapshot.directory.users)user.rootRoleAssignmentIds=roots.filter(r=>r.admin_user_id===user.adminUserId).map(r=>String(r.role_assignment_id));
          }
          if(selector.directory==='workspaces'||selector.directory==='rights'){
            const ws=(await client.query(`SELECT w.* FROM workspaces w JOIN tenants t ON t.tenant_id=w.tenant_id WHERE w.status='active' AND t.status='active'${rightsWrite||workspaceWrite?' FOR SHARE OF w,t':''}`)).rows.map(map.workspace).filter(present);
            const metadataOnly=selector.directory==='rights'||workspaceWrite;
            const files=(metadataOnly?[]:(await client.query('SELECT source_package_id,tenant_id,workspace_id,status,uploaded_at FROM source_packages')).rows).map(r=>({sourcePackageId:String(r.source_package_id),tenantId:String(r.tenant_id),workspaceId:String(r.workspace_id),status:r.status as import('@testcenter-rewrite-app/domain').SourcePackageStatus,uploadedAt:String(r.uploaded_at)}));
            const events=(metadataOnly?[]:(await client.query("SELECT tenant_id,workspace_id,event_type,subject_id,details_json FROM workspace_activity_events WHERE event_type IN ('source_package_assembled','source_package_replaced')")).rows).map(r=>({tenantId:String(r.tenant_id),workspaceId:String(r.workspace_id),eventType:r.event_type as import('@testcenter-rewrite-app/domain').WorkspaceActivityEvent['eventType'],subjectId:String(r.subject_id),details:typeof r.details_json==='string'?JSON.parse(r.details_json) as Record<string,unknown>:r.details_json as Record<string,unknown>}));
            const mappings=(await client.query('SELECT * FROM original_workspace_numbers')).rows;
            snapshot.directory.workspaces=ws.map(w=>{const n=mappings.find(n=>n.workspace_id===w.workspaceId);if(n&&n.tenant_id!==w.tenantId)throw Error('Native workspace directory identity scope changed.');return{workspace:w,workspaceNumber:n?String(n.workspace_number):null,latestModificationAt:metadataOnly?null:originalDirectoryModification(files,events,w.tenantId,w.workspaceId)};});
            if(workspaceWrite){
              const ids=[...new Set(ws.map(w=>w.tenantId))];
              snapshot.directory.tenants=ids.length?(await client.query('SELECT * FROM tenants WHERE tenant_id=ANY($1::text[])',[ids])).rows.map(map.tenant).filter(present):[];
              if(workspaceWrite==='create')snapshot.directory.creationTenant=map.tenant((await client.query('SELECT * FROM tenants WHERE tenant_key=$1 FOR SHARE',[originalAdministrationWorkspaceTenantKey])).rows[0]);
            }
          }
        }
        if(root&&selector.directory==='rights'){
          const ids=snapshot.directory!.workspaces!.map(w=>w.workspace.workspaceId);
          snapshot.directory!.roles=ids.length?(await client.query("SELECT * FROM admin_role_assignments WHERE role IN ('workspace_admin','native_workspace_opaque') AND group_key IS NULL AND workspace_id=ANY($1::text[])",[ids])).rows.map(map.role).filter(present):[];
        }
        if(selector.targetAdminNumber!==undefined){
          const n=(await client.query('SELECT * FROM original_admin_numbers WHERE admin_number=$1',[selector.targetAdminNumber])).rows[0];
          const target=n&&(root||n.admin_user_id===user!.adminUserId)?map.user((await client.query('SELECT * FROM admin_users WHERE admin_user_id=$1 FOR UPDATE',[n.admin_user_id])).rows[0]):null;
          if(n&&target)snapshot.target={user:target,number:{adminUserId:target.adminUserId,adminNumber:String(n.admin_number)},sessions:(await client.query('SELECT * FROM admin_sessions WHERE admin_user_id=$1 FOR UPDATE',[target.adminUserId])).rows.map(map.session).filter(present)};
        }
      }
      const effect = transform(structuredClone(snapshot));
      validateOriginalAdminRoleChanges(snapshot,effect,selector);
      validateOriginalWorkspaceDirectoryEffect(snapshot,effect,selector);
      validateOriginalAdminLifecycleEffect(snapshot,effect,selector);
      validateOriginalAdminDeletionEffect(snapshot,effect,selector);
      for(const user of effect.deletedUsers??[]){
        await client.query('DELETE FROM admin_role_assignments WHERE admin_user_id=$1',[user.adminUserId]);
        await client.query('DELETE FROM admin_sessions WHERE admin_user_id=$1',[user.adminUserId]);
        const identity=await client.query('DELETE FROM original_admin_numbers WHERE admin_user_id=$1 AND admin_number=$2',[user.adminUserId,user.adminNumber]);
        if(identity.rowCount!==1)throw Error('Native user deletion identity changed.');
        const deleted=await client.query('DELETE FROM admin_users WHERE admin_user_id=$1',[user.adminUserId]);
        if(deleted.rowCount!==1)throw Error('Native user deletion target changed.');
      }
      if(effect.rootRoleChange){
        const c=effect.rootRoleChange;
        for(const id of c.removeIds){const changed=await client.query("DELETE FROM admin_role_assignments WHERE role_assignment_id=$1 AND admin_user_id=$2 AND role='platform_admin'",[id,c.adminUserId]);if(changed.rowCount!==1)throw Error('Native Root removal identity changed.');}
        if(c.assignment){const r=c.assignment;await client.query('INSERT INTO admin_role_assignments(role_assignment_id,admin_user_id,role,access_mode,tenant_id,workspace_id,group_key,monitor_profiles_json,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)',
          [r.roleAssignmentId,r.adminUserId,r.role,r.accessMode,null,null,null,JSON.stringify({monitorProfiles:[],monitorBookletVisibility:'visible'}),r.createdAt]);}
      }
      if(effect.workspaceChange){
        const c=effect.workspaceChange,w=c.workspace,t=c.tenant;
        if(c.kind==='create'){
          if((await client.query('SELECT 1 FROM workspaces WHERE workspace_id=$1 OR workspace_key=$2',[w.workspaceId,w.workspaceKey])).rowCount)throw Error('Native workspace creation identity collision.');
          if(c.createTenant)await client.query('INSERT INTO tenants(tenant_id,tenant_key,display_name,status,created_at) VALUES($1,$2,$3,$4,$5)',[t.tenantId,t.tenantKey,t.displayName,t.status,t.createdAt]);
          await client.query('INSERT INTO workspaces(workspace_id,tenant_id,tenant_key,workspace_key,display_name,status,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[w.workspaceId,w.tenantId,t.tenantKey,w.workspaceKey,w.displayName,w.status,w.createdAt]);
        }else{
          const changed=await client.query("UPDATE workspaces SET display_name=$1 WHERE workspace_id=$2 AND tenant_id=$3 AND status='active'",[w.displayName,w.workspaceId,w.tenantId]);
          if(changed.rowCount!==1)throw Error('Native workspace rename scope changed.');
        }
      }
      if (effect.user) await client.query('UPDATE admin_users SET first_signed_in_at=$1,password_hash=$2,password_change_required=$3 WHERE admin_user_id=$4', [effect.user.firstSignedInAt,effect.user.passwordHash,effect.user.passwordChangeRequired,effect.user.adminUserId]);
      if(effect.targetUser){if(effect.targetUser.adminUserId!==snapshot.target?.user.adminUserId)throw Error('Native target administrator scope changed.');await client.query('UPDATE admin_users SET password_hash=$1,password_change_required=$2 WHERE admin_user_id=$3',[effect.targetUser.passwordHash,effect.targetUser.passwordChangeRequired,effect.targetUser.adminUserId]);}
      if(effect.createdUser){const u=effect.createdUser;await client.query('INSERT INTO admin_users(admin_user_id,username,display_name,password_hash,password_change_required,status,custom_texts_json,valid_from,valid_to,valid_for_minutes,first_signed_in_at,created_at) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12)',[u.adminUserId,u.username,u.displayName,u.passwordHash,u.passwordChangeRequired,u.status,JSON.stringify(u.customTexts),u.validFrom,u.validTo,u.validForMinutes,u.firstSignedInAt,u.createdAt]);}
      if (effect.attempt) {
        const a = effect.attempt;
        await client.query(`INSERT INTO admin_login_attempts(username,failed_attempts,expires_at,updated_at) VALUES($1,$2,$3,$4)
          ON CONFLICT(username) DO UPDATE SET failed_attempts=CASE WHEN excluded.failed_attempts=0 THEN 0
            WHEN admin_login_attempts.expires_at<=excluded.updated_at THEN 1 ELSE admin_login_attempts.failed_attempts+1 END,
          expires_at=excluded.expires_at,updated_at=excluded.updated_at`, [a.username, a.failedAttempts, a.expiresAt, a.updatedAt]);
      }
      for (const s of [...effect.sessions??[],...effect.targetSessions??[]]) {
        if (!user || !(s.adminUserId===user.adminUserId||s.adminUserId===snapshot.target?.user.adminUserId)) throw Error('Native administrator session scope changed.');
        const insertion=await client.query(`INSERT INTO admin_sessions(admin_session_id,admin_user_id,session_token,created_at,expires_at,revoked_at) VALUES($1,$2,$3,$4,$5,$6)
          ON CONFLICT(admin_session_id) DO UPDATE SET expires_at=excluded.expires_at,revoked_at=excluded.revoked_at WHERE admin_sessions.admin_user_id=excluded.admin_user_id AND admin_sessions.session_token=excluded.session_token`, [s.adminSessionId, s.adminUserId, s.token, s.createdAt, s.expiresAt, s.revokedAt]);
        if(insertion.rowCount!==1)throw Error('Native administrator session identity collision.');
      }
      for(const n of [...effect.adminNumbers??[],...effect.number?[effect.number]:[]])await client.query('INSERT INTO original_admin_numbers(admin_number,admin_user_id) VALUES($1,$2) ON CONFLICT(admin_user_id) DO NOTHING',[n.adminNumber,n.adminUserId]);
      if (effect.counter !== undefined) await client.query('UPDATE original_admin_number_counter SET last_number=$1 WHERE singleton=1', [effect.counter]);
      for (const n of effect.workspaceNumbers ?? []) await client.query('INSERT INTO original_workspace_numbers(workspace_number,workspace_id,tenant_id) VALUES($1,$2,$3)', [n.workspaceNumber, n.workspaceId, n.tenantId]);
      if (effect.workspaceCounter !== undefined) await client.query('UPDATE original_workspace_number_counter SET last_number=$1 WHERE singleton=1', [effect.workspaceCounter]);
      for(const roleId of effect.roleChanges?.removeIds??[])await client.query("DELETE FROM admin_role_assignments WHERE role_assignment_id=$1 AND role IN ('workspace_admin','native_workspace_opaque') AND group_key IS NULL",[roleId]);
      for(const r of effect.roleChanges?.assignments??[]){
        const changed=await client.query(`INSERT INTO admin_role_assignments(role_assignment_id,admin_user_id,role,access_mode,tenant_id,workspace_id,group_key,monitor_profiles_json,created_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) ON CONFLICT(role_assignment_id) DO UPDATE SET role=excluded.role,access_mode=excluded.access_mode,monitor_profiles_json=excluded.monitor_profiles_json
          WHERE admin_role_assignments.role IN ('workspace_admin','native_workspace_opaque') AND admin_role_assignments.group_key IS NULL
            AND admin_role_assignments.admin_user_id=excluded.admin_user_id AND admin_role_assignments.tenant_id=excluded.tenant_id AND admin_role_assignments.workspace_id=excluded.workspace_id`,
          [r.roleAssignmentId,r.adminUserId,r.role,r.accessMode,r.tenantId,r.workspaceId,r.groupKey,JSON.stringify({monitorProfiles:r.monitorProfiles,monitorBookletVisibility:r.monitorBookletVisibility,...r.role==='native_workspace_opaque'?{nativeWorkspaceRole:r.nativeWorkspaceRole}:{}}),r.createdAt]);
        if(changed.rowCount!==1)throw Error('Native permission identity collision.');
      }
      for(const a of [...(effect.audit?[effect.audit]:[]),...(effect.audits??[])]) {
        await client.query('INSERT INTO admin_audit_events(admin_audit_event_id,event_type,actor_admin_user_id,subject_admin_user_id,occurred_at,summary,details_json) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)',
          [a.adminAuditEventId, a.eventType, a.actorAdminUserId, a.subjectAdminUserId, a.occurredAt, a.summary, JSON.stringify(a.details)]);
      }
      await client.query('COMMIT');
      return effect;
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (rollback) {throw new AggregateError([error, rollback], 'Native administrator session rollback failed.');}
      const code = (error as {code?: string}).code;
      if (!['40001', '40P01'].includes(code ?? '') || attempt >= 15) throw error;
    } finally {client.release();}
    await setTimeout(Math.min(2 ** attempt, 16));
  }
}
