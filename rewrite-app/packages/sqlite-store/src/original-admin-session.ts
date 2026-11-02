import type {DatabaseSync} from 'node:sqlite';
import type {AdminUser, AdminSession, AdminRoleAssignment, AdminLoginAttempt, Workspace, Tenant} from '@testcenter-rewrite-app/domain';
import {selectOriginalAdminIdentity, originalAdminFailureBucket, type OriginalAdminSelector, type OriginalAdminSessionSnapshot, type OriginalAdminSessionEffect} from '@testcenter-rewrite-app/application';
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
      (SELECT 1 FROM admin_role_assignments r WHERE r.admin_user_id=? AND r.role='workspace_admin' AND r.workspace_id=w.workspace_id AND r.tenant_id=w.tenant_id)`)
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
    const effect = transform(snapshot);
    if (effect.user) database.prepare('UPDATE admin_users SET first_signed_in_at=? WHERE admin_user_id=?').run(effect.user.firstSignedInAt, effect.user.adminUserId);
    if (effect.attempt) {
      const a = effect.attempt;
      database.prepare(`INSERT INTO admin_login_attempts(username,failed_attempts,expires_at,updated_at) VALUES(?,?,?,?)
        ON CONFLICT(username) DO UPDATE SET failed_attempts=excluded.failed_attempts,expires_at=excluded.expires_at,updated_at=excluded.updated_at`)
        .run(a.username, a.failedAttempts, a.expiresAt, a.updatedAt);
    }
    for (const s of effect.sessions ?? []) {
      if (!user || s.adminUserId !== user.adminUserId) throw Error('Native administrator session scope changed.');
      const insertion=database.prepare(`INSERT INTO admin_sessions(admin_session_id,admin_user_id,session_token,created_at,expires_at,revoked_at) VALUES(?,?,?,?,?,?)
        ON CONFLICT(admin_session_id) DO UPDATE SET expires_at=excluded.expires_at,revoked_at=excluded.revoked_at WHERE admin_sessions.admin_user_id=excluded.admin_user_id AND admin_sessions.session_token=excluded.session_token`)
        .run(s.adminSessionId, s.adminUserId, s.token, s.createdAt, s.expiresAt, s.revokedAt);
      if(Number(insertion.changes)!==1)throw Error('Native administrator session identity collision.');
    }
    if (effect.number) database.prepare('INSERT INTO original_admin_numbers(admin_number,admin_user_id) VALUES(?,?) ON CONFLICT(admin_user_id) DO NOTHING').run(effect.number.adminNumber, effect.number.adminUserId);
    if (effect.counter !== undefined) database.prepare('UPDATE original_admin_number_counter SET last_number=? WHERE singleton=1').run(effect.counter);
    for (const n of effect.workspaceNumbers ?? []) database.prepare('INSERT INTO original_workspace_numbers(workspace_number,workspace_id,tenant_id) VALUES(?,?,?)').run(n.workspaceNumber, n.workspaceId, n.tenantId);
    if (effect.workspaceCounter !== undefined) database.prepare('UPDATE original_workspace_number_counter SET last_number=? WHERE singleton=1').run(effect.workspaceCounter);
    if (effect.audit) {
      const a = effect.audit;
      database.prepare('INSERT INTO admin_audit_events(admin_audit_event_id,event_type,actor_admin_user_id,subject_admin_user_id,occurred_at,summary,details_json) VALUES(?,?,?,?,?,?,?)')
        .run(a.adminAuditEventId, a.eventType, a.actorAdminUserId, a.subjectAdminUserId, a.occurredAt, a.summary, JSON.stringify(a.details));
    }
    database.exec('COMMIT');
    return effect;
  } catch (error) { return rollbackAfterFailure(database, error); }
}
