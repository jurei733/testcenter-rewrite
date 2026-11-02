import type {AdminUser, AdminSession, AdminRoleAssignment, AdminLoginAttempt, AdminAuditEvent, Tenant, Workspace} from '@testcenter-rewrite-app/domain';
import {selectOriginalAdminIdentity, originalAdminFailureBucket, type OriginalAdminNumber, type OriginalAdminSelector, type OriginalAdminSessionSnapshot, type OriginalAdminSessionEffect} from './original-admin-session.js';
import type {OriginalWorkspaceNumberRecord} from './original-workspace-number.js';

type Rows<T> = Map<string, T> | Record<string, T>;
const values = <T>(rows: Rows<T>): T[] => rows instanceof Map ? [...rows.values()] : Object.values(rows);
const set = <T>(rows: Rows<T>, key: string, value: T) => {if (rows instanceof Map) rows.set(key, value); else rows[key] = value;};
export type OriginalAdminCollections = {
  adminUsers: Rows<AdminUser>; adminLoginAttempts: Rows<AdminLoginAttempt>; adminRoleAssignments: Rows<AdminRoleAssignment>;
  adminAuditEvents: Rows<AdminAuditEvent>; tenants: Rows<Tenant>; workspacesByScope: Rows<Workspace>;
  originalAdminNumbers?: Rows<OriginalAdminNumber>; originalAdminNumberCounter?: string;
  originalWorkspaceNumbers?: Rows<OriginalWorkspaceNumberRecord>; originalWorkspaceNumberCounter?: string;
};
/** Called only inside Memory's synchronous boundary or File's durable writer.
 * No Run, response, release or other actor's credential payload is projected. */
export function mutateOriginalAdminCollections(state: OriginalAdminCollections, sessions: Rows<AdminSession>, sessionKey: 'token' | 'adminSessionId',
  selector: OriginalAdminSelector, transform: (snapshot: OriginalAdminSessionSnapshot) => OriginalAdminSessionEffect): OriginalAdminSessionEffect {
  const allSessions = values(sessions);
  const id = 'name' in selector ? selectOriginalAdminIdentity(values(state.adminUsers), selector.name) : allSessions.find(row => row.token === selector.token)?.adminUserId ?? null;
  const user = values(state.adminUsers).find(row => row.adminUserId === id) ?? null;
  const roles = values(state.adminRoleAssignments).filter(row => row.adminUserId === id);
  const workspaces = values(state.workspacesByScope).filter(w => roles.some(r => r.role === 'workspace_admin' && r.workspaceId === w.workspaceId && r.tenantId === w.tenantId));
  const bucket = 'name' in selector ? originalAdminFailureBucket(user?.username ?? selector.name) : '';
  const effect = transform(structuredClone({user, sessions: allSessions.filter(row => row.adminUserId === id), roles, workspaces,
    tenants: values(state.tenants).filter(t => workspaces.some(w => w.tenantId === t.tenantId)),
    attempt: values(state.adminLoginAttempts).find(row => row.username === bucket) ?? null,
    number: values(state.originalAdminNumbers ?? {}).find(row => row.adminUserId === id) ?? null,
    counter: state.originalAdminNumberCounter ?? '0', workspaceCounter: state.originalWorkspaceNumberCounter ?? '0',
    workspaceNumbers: values(state.originalWorkspaceNumbers ?? {}).filter(row => workspaces.some(w => w.workspaceId === row.workspaceId && w.tenantId === row.tenantId))}));
  // Validate every foreign-token collision before editing even an in-memory row.
  for (const row of effect.sessions ?? []) if (row.adminUserId !== id || allSessions.some(old => old.token === row.token && old.adminSessionId !== row.adminSessionId || old.adminSessionId === row.adminSessionId && (old.token !== row.token || old.adminUserId !== row.adminUserId))) throw Error('Native administrator session ownership/collision conflict.');
  if (effect.user) set(state.adminUsers, effect.user.adminUserId, effect.user);
  if (effect.attempt) set(state.adminLoginAttempts, effect.attempt.username, effect.attempt);
  if (effect.audit) set(state.adminAuditEvents, effect.audit.adminAuditEventId, effect.audit);
  for (const row of effect.sessions ?? []) set(sessions, row[sessionKey], row);
  if (effect.number) {state.originalAdminNumbers ??= {}; set(state.originalAdminNumbers, effect.number.adminUserId, effect.number);}
  if (effect.counter !== undefined) state.originalAdminNumberCounter = effect.counter;
  if (effect.workspaceNumbers?.length) {state.originalWorkspaceNumbers ??= {}; for (const row of effect.workspaceNumbers) set(state.originalWorkspaceNumbers, row.workspaceId, row);}
  if (effect.workspaceCounter !== undefined) state.originalWorkspaceNumberCounter = effect.workspaceCounter;
  return effect;
}
