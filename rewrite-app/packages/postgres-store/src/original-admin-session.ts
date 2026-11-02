import type {Pool} from 'pg';
import {setTimeout} from 'node:timers/promises';
import type {AdminUser, AdminSession, AdminRoleAssignment, AdminLoginAttempt, Workspace, Tenant} from '@testcenter-rewrite-app/domain';
import {selectOriginalAdminIdentity, originalAdminFailureBucket, type OriginalAdminSelector, type OriginalAdminSessionSnapshot, type OriginalAdminSessionEffect} from '@testcenter-rewrite-app/application';

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
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
      const counter = (await client.query('SELECT last_number FROM original_admin_number_counter WHERE singleton=1 FOR UPDATE')).rows[0];
      const id = 'name' in selector ? selectOriginalAdminIdentity((await client.query('SELECT admin_user_id,username FROM admin_users')).rows.map(row =>
        ({adminUserId: String(row.admin_user_id), username: String(row.username)})), selector.name)
        : (await client.query('SELECT admin_user_id FROM admin_sessions WHERE session_token=$1', [selector.token])).rows[0]?.admin_user_id;
      const user = id ? map.user((await client.query('SELECT * FROM admin_users WHERE admin_user_id=$1 FOR UPDATE', [id])).rows[0]) : null;
      const roles = user ? (await client.query('SELECT * FROM admin_role_assignments WHERE admin_user_id=$1 ORDER BY created_at', [user.adminUserId])).rows.map(map.role).filter(present) : [];
      const workspaces = user ? (await client.query(`SELECT w.* FROM workspaces w WHERE EXISTS
        (SELECT 1 FROM admin_role_assignments r WHERE r.admin_user_id=$1 AND r.role='workspace_admin' AND r.workspace_id=w.workspace_id AND r.tenant_id=w.tenant_id)`, [user.adminUserId])).rows.map(map.workspace).filter(present) : [];
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
      const effect = transform(snapshot);
      if (effect.user) await client.query('UPDATE admin_users SET first_signed_in_at=$1 WHERE admin_user_id=$2', [effect.user.firstSignedInAt, effect.user.adminUserId]);
      if (effect.attempt) {
        const a = effect.attempt;
        await client.query(`INSERT INTO admin_login_attempts(username,failed_attempts,expires_at,updated_at) VALUES($1,$2,$3,$4)
          ON CONFLICT(username) DO UPDATE SET failed_attempts=CASE WHEN excluded.failed_attempts=0 THEN 0
            WHEN admin_login_attempts.expires_at<=excluded.updated_at THEN 1 ELSE admin_login_attempts.failed_attempts+1 END,
          expires_at=excluded.expires_at,updated_at=excluded.updated_at`, [a.username, a.failedAttempts, a.expiresAt, a.updatedAt]);
      }
      for (const s of effect.sessions ?? []) {
        if (!user || s.adminUserId !== user.adminUserId) throw Error('Native administrator session scope changed.');
        const insertion=await client.query(`INSERT INTO admin_sessions(admin_session_id,admin_user_id,session_token,created_at,expires_at,revoked_at) VALUES($1,$2,$3,$4,$5,$6)
          ON CONFLICT(admin_session_id) DO UPDATE SET expires_at=excluded.expires_at,revoked_at=excluded.revoked_at WHERE admin_sessions.admin_user_id=excluded.admin_user_id AND admin_sessions.session_token=excluded.session_token`, [s.adminSessionId, s.adminUserId, s.token, s.createdAt, s.expiresAt, s.revokedAt]);
        if(insertion.rowCount!==1)throw Error('Native administrator session identity collision.');
      }
      if (effect.number) await client.query('INSERT INTO original_admin_numbers(admin_number,admin_user_id) VALUES($1,$2) ON CONFLICT(admin_user_id) DO NOTHING', [effect.number.adminNumber, effect.number.adminUserId]);
      if (effect.counter !== undefined) await client.query('UPDATE original_admin_number_counter SET last_number=$1 WHERE singleton=1', [effect.counter]);
      for (const n of effect.workspaceNumbers ?? []) await client.query('INSERT INTO original_workspace_numbers(workspace_number,workspace_id,tenant_id) VALUES($1,$2,$3)', [n.workspaceNumber, n.workspaceId, n.tenantId]);
      if (effect.workspaceCounter !== undefined) await client.query('UPDATE original_workspace_number_counter SET last_number=$1 WHERE singleton=1', [effect.workspaceCounter]);
      if (effect.audit) {
        const a = effect.audit;
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
