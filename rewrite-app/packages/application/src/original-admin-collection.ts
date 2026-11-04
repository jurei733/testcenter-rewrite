import type {AdminUser, AdminSession, AdminRoleAssignment, AdminLoginAttempt, AdminAuditEvent, Tenant, Workspace} from '@testcenter-rewrite-app/domain';
import {originalDirectoryModification,type OriginalDirectoryFile,type OriginalDirectoryFileEvent} from './original-admin-directory.js';
import {originalAdminMetadataAllowed,selectOriginalAdminIdentity, originalAdminFailureBucket, type OriginalAdminNumber, type OriginalAdminSelector, type OriginalAdminSessionSnapshot, type OriginalAdminSessionEffect} from './original-admin-session.js';
import type {OriginalWorkspaceNumberRecord} from './original-workspace-number.js';
import {validateOriginalAdminRoleChanges} from './original-admin-permissions.js';
import {isOriginalWorkspaceMembership} from './original-workspace-role.js';
import {originalAdministrationWorkspaceTenantKey,validateOriginalWorkspaceDirectoryEffect} from './original-workspace-directory.js';
import {validateOriginalAdminLifecycleEffect} from './original-admin-lifecycle.js';

type Rows<T> = Map<string, T> | Record<string, T>;
const values = <T>(rows: Rows<T>): T[] => rows instanceof Map ? [...rows.values()] : Object.values(rows);
const set = <T>(rows: Rows<T>, key: string, value: T) => {if (rows instanceof Map) rows.set(key, value); else rows[key] = value;};
const get = <T>(rows: Rows<T>, key: string):T|undefined => rows instanceof Map?rows.get(key):Object.hasOwn(rows,key)?rows[key]:undefined;
const remove = <T>(rows: Rows<T>, key: string) => {if(rows instanceof Map)rows.delete(key);else delete rows[key];};
export type OriginalAdminCollections = {
  adminUsers: Rows<AdminUser>; adminLoginAttempts: Rows<AdminLoginAttempt>; adminRoleAssignments: Rows<AdminRoleAssignment>;
  adminAuditEvents: Rows<AdminAuditEvent>; tenants: Rows<Tenant>; workspacesByScope: Rows<Workspace>;
  workspacesByKey?:Rows<Workspace>;
  originalAdminNumbers?: Rows<OriginalAdminNumber>; originalAdminNumberCounter?: string;
  originalWorkspaceNumbers?: Rows<OriginalWorkspaceNumberRecord>; originalWorkspaceNumberCounter?: string;
  sourcePackages?:Rows<OriginalDirectoryFile>;workspaceActivityEvents?:Rows<OriginalDirectoryFileEvent>;
};
/** Called only inside Memory's synchronous boundary or File's durable writer.
 * No Run, response, release or other actor's credential payload is projected. */
export function mutateOriginalAdminCollections(state: OriginalAdminCollections, sessions: Rows<AdminSession>, sessionKey: 'token' | 'adminSessionId',
  selector: OriginalAdminSelector, transform: (snapshot: OriginalAdminSessionSnapshot) => OriginalAdminSessionEffect): OriginalAdminSessionEffect {
  const allSessions = values(sessions);
  const id = 'name' in selector ? selectOriginalAdminIdentity(values(state.adminUsers), selector.name) : allSessions.find(row => row.token === selector.token)?.adminUserId ?? null;
  const user = values(state.adminUsers).find(row => row.adminUserId === id) ?? null;
  const roles = values(state.adminRoleAssignments).filter(row => row.adminUserId === id);
  const workspaces = values(state.workspacesByScope).filter(w => roles.some(r => isOriginalWorkspaceMembership(r) && r.workspaceId === w.workspaceId && r.tenantId === w.tenantId));
  const bucket = 'name' in selector ? originalAdminFailureBucket(user?.username ?? selector.name) : '';
  const snapshot:OriginalAdminSessionSnapshot = {user, sessions: allSessions.filter(row => row.adminUserId === id), roles, workspaces,
    tenants: values(state.tenants).filter(t => workspaces.some(w => w.tenantId === t.tenantId)),
    attempt: values(state.adminLoginAttempts).find(row => row.username === bucket) ?? null,
    number: values(state.originalAdminNumbers ?? {}).find(row => row.adminUserId === id) ?? null,
    counter: state.originalAdminNumberCounter ?? '0', workspaceCounter: state.originalWorkspaceNumberCounter ?? '0',
    workspaceNumbers: values(state.originalWorkspaceNumbers ?? {}).filter(row => workspaces.some(w => w.workspaceId === row.workspaceId && w.tenantId === row.tenantId))};
  if('token' in selector&&originalAdminMetadataAllowed(snapshot,selector)){
    const root=roles.some(r=>r.role==='platform_admin');
    if(selector.directory&&root){
      snapshot.directory={};
      if(selector.directory==='users'||selector.directory==='rights')snapshot.directory.users=values(state.adminUsers).map(u=>({adminUserId:u.adminUserId,username:u.username,adminNumber:values(state.originalAdminNumbers??{}).find(n=>n.adminUserId===u.adminUserId)?.adminNumber??null,isSuperadmin:values(state.adminRoleAssignments).some(r=>r.adminUserId===u.adminUserId&&r.role==='platform_admin'),
        ...selector.adminWrite?{rootRoleAssignmentIds:values(state.adminRoleAssignments).filter(r=>r.adminUserId===u.adminUserId&&r.role==='platform_admin').map(r=>r.roleAssignmentId)}:{}}));
      if(selector.directory==='workspaces'||selector.directory==='rights')snapshot.directory.workspaces=values(state.workspacesByScope).filter(w=>w.status==='active'&&values(state.tenants).some(t=>t.tenantId===w.tenantId&&t.status==='active')).map(w=>{
        const number=values(state.originalWorkspaceNumbers??{}).find(n=>n.workspaceId===w.workspaceId);
        if(number&&number.tenantId!==w.tenantId)throw Error('Native workspace directory identity scope changed.');
        return{workspace:w,workspaceNumber:number?.workspaceNumber??null,latestModificationAt:selector.directory==='rights'||selector.workspaceWrite?null:originalDirectoryModification(values(state.sourcePackages??{}),values(state.workspaceActivityEvents??{}).filter(e=>e.eventType==='source_package_assembled'||e.eventType==='source_package_replaced'),w.tenantId,w.workspaceId)};
      });
      if(selector.workspaceWrite){
        snapshot.directory.tenants=values(state.tenants).filter(t=>snapshot.directory!.workspaces!.some(w=>w.workspace.tenantId===t.tenantId));
        if(selector.workspaceWrite==='create')snapshot.directory.creationTenant=values(state.tenants).find(t=>t.tenantKey===originalAdministrationWorkspaceTenantKey)??null;
      }
      if(selector.directory==='rights')snapshot.directory.roles=values(state.adminRoleAssignments).filter(r=>isOriginalWorkspaceMembership(r)&&r.groupKey===null&&snapshot.directory!.workspaces!.some(w=>w.workspace.workspaceId===r.workspaceId&&w.workspace.tenantId===r.tenantId));
    }
    if(selector.targetAdminNumber!==undefined){
      const number=values(state.originalAdminNumbers??{}).find(n=>n.adminNumber===selector.targetAdminNumber);
      const target=number&&(root||number.adminUserId===id)?values(state.adminUsers).find(u=>u.adminUserId===number.adminUserId):undefined;
      if(number&&target)snapshot.target={user:target,number,sessions:allSessions.filter(s=>s.adminUserId===target.adminUserId)};
    }
  }
  const effect=transform(structuredClone(snapshot));
  validateOriginalAdminRoleChanges(snapshot,effect,selector);
  validateOriginalWorkspaceDirectoryEffect(snapshot,effect,selector);
  validateOriginalAdminLifecycleEffect(snapshot,effect,selector);
  // Validate every foreign-token collision before editing even an in-memory row.
  const audits=[...effect.audit?[effect.audit]:[],...effect.audits??[]];
  if(new Set(audits.map(a=>a.adminAuditEventId)).size!==audits.length||audits.some(a=>values(state.adminAuditEvents).some(old=>old.adminAuditEventId===a.adminAuditEventId)))throw Error('Native administrator audit identity collision.');
  for(const role of effect.roleChanges?.assignments??[]){const previous=values(state.adminRoleAssignments).find(r=>r.roleAssignmentId===role.roleAssignmentId);if(previous&&!snapshot.directory?.roles?.some(r=>r.roleAssignmentId===previous.roleAssignmentId))throw Error('Native permission identity collision.');}
  if(effect.rootRoleChange?.assignment&&values(state.adminRoleAssignments).some(r=>r.roleAssignmentId===effect.rootRoleChange!.assignment!.roleAssignmentId))throw Error('Native Root assignment identity collision.');
  if(effect.user&&effect.user.adminUserId!==id)throw Error('Native administrator mutation scope changed.');
  if(effect.createdUser&&values(state.adminUsers).some(u=>u.adminUserId===effect.createdUser!.adminUserId||u.username===effect.createdUser!.username))throw Error('Native administrator creation identity collision.');
  if(effect.targetUser&&effect.targetUser.adminUserId!==snapshot.target?.user.adminUserId)throw Error('Native target administrator scope changed.');
  const change=effect.workspaceChange;
  if(change){
    if(!state.workspacesByKey)throw Error('Native workspace index is unavailable.');
    const w=change.workspace,t=change.tenant,scope=t.tenantKey+'::'+w.workspaceKey,indexed=get(state.workspacesByScope,scope);
    if(change.kind==='create'){
      if(indexed||values(state.workspacesByScope).some(old=>old.workspaceId===w.workspaceId||old.workspaceKey===w.workspaceKey)||get(state.workspacesByKey,w.workspaceKey))throw Error('Native workspace creation identity collision.');
      if(change.createTenant&&values(state.tenants).some(old=>old.tenantId===t.tenantId||old.tenantKey===t.tenantKey))throw Error('Native workspace creation tenant collision.');
      const n=effect.workspaceNumbers![0]!;
      if(values(state.originalWorkspaceNumbers??{}).some(old=>old.workspaceId===w.workspaceId||old.workspaceNumber===n.workspaceNumber))throw Error('Native workspace numeric identity collision.');
    }else if(!indexed||indexed.workspaceId!==w.workspaceId||indexed.tenantId!==t.tenantId)throw Error('Native workspace rename index changed.');
  }
  for (const row of [...effect.sessions??[],...effect.targetSessions??[]]) if (!(row.adminUserId===id||row.adminUserId===snapshot.target?.user.adminUserId) || allSessions.some(old => old.token === row.token && old.adminSessionId !== row.adminSessionId || old.adminSessionId === row.adminSessionId && (old.token !== row.token || old.adminUserId !== row.adminUserId))) throw Error('Native administrator session ownership/collision conflict.');
  if (effect.user) set(state.adminUsers, effect.user.adminUserId, effect.user);
  if(effect.createdUser)set(state.adminUsers,effect.createdUser.adminUserId,effect.createdUser);
  if(effect.targetUser)set(state.adminUsers,effect.targetUser.adminUserId,effect.targetUser);
  if (effect.attempt) set(state.adminLoginAttempts, effect.attempt.username, effect.attempt);
  for(const audit of audits)set(state.adminAuditEvents,audit.adminAuditEventId,audit);
  for(const id of effect.roleChanges?.removeIds??[])remove(state.adminRoleAssignments,id);
  for(const role of effect.roleChanges?.assignments??[])set(state.adminRoleAssignments,role.roleAssignmentId,role);
  for(const id of effect.rootRoleChange?.removeIds??[])remove(state.adminRoleAssignments,id);
  if(effect.rootRoleChange?.assignment)set(state.adminRoleAssignments,effect.rootRoleChange.assignment.roleAssignmentId,effect.rootRoleChange.assignment);
  for (const row of [...effect.sessions??[],...effect.targetSessions??[]]) set(sessions, row[sessionKey], row);
  if(change){
    const w=change.workspace,t=change.tenant;
    if(change.createTenant)set(state.tenants,t.tenantKey,t);
    set(state.workspacesByScope,t.tenantKey+'::'+w.workspaceKey,w);
    // Canonical workspaces may share a key across tenants. Preserve a foreign
    // short-key alias rather than repointing it while renaming this scope.
    const alias=get(state.workspacesByKey!,w.workspaceKey);
    if(change.kind==='create'||alias?.workspaceId===w.workspaceId)set(state.workspacesByKey!,w.workspaceKey,w);
  }
  for(const number of [...effect.adminNumbers??[],...effect.number?[effect.number]:[]]){state.originalAdminNumbers??={};set(state.originalAdminNumbers,number.adminUserId,number);}
  if (effect.counter !== undefined) state.originalAdminNumberCounter = effect.counter;
  if (effect.workspaceNumbers?.length) {state.originalWorkspaceNumbers ??= {}; for (const row of effect.workspaceNumbers) set(state.originalWorkspaceNumbers, row.workspaceId, row);}
  if (effect.workspaceCounter !== undefined) state.originalWorkspaceNumberCounter = effect.workspaceCounter;
  return effect;
}
