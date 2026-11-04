import type {AdminUser, AdminSession, AdminRoleAssignment, AdminLoginAttempt, AdminAuditEvent, Workspace, Tenant} from '@testcenter-rewrite-app/domain';
import type {OriginalAdminAccessSet} from '@testcenter-rewrite-app/contracts/original-session';
import {FirstSliceError} from './first-slice-error.js';
import {originalParticipantGroupKeysEqual} from './original-participant-group.js';
import {createOriginalSessionToken} from './original-session-token.js';
import {prepareOriginalWorkspaceNumber, type OriginalWorkspaceNumberRecord} from './original-workspace-number.js';
import {encodeOriginalReportJson} from './original-workspace-report-wire.js';
import {isOriginalWorkspaceMembership,originalWorkspaceRoleValue} from './original-workspace-role.js';

export type OriginalAdminNumber = {adminUserId: string; adminNumber: string};
export type OriginalAdminSelector = {name: string} | {token: string; at?: string; directory?: 'users' | 'workspaces' | 'rights'; rightsWrite?: boolean; workspaceWrite?:'create'|'rename'; targetAdminNumber?: string};
export type OriginalAdminDirectoryUser = {adminUserId:string;username:string;adminNumber:string|null;isSuperadmin:boolean};
export type OriginalAdminDirectoryWorkspace = {workspace:Workspace;workspaceNumber:string|null;latestModificationAt:string|null};
export type OriginalAdminSessionSnapshot = {
  user: AdminUser | null; sessions: AdminSession[]; roles: AdminRoleAssignment[];
  workspaces: Workspace[]; tenants: Tenant[]; attempt: AdminLoginAttempt | null;
  number: OriginalAdminNumber | null; counter: string;
  directory?: {users?:OriginalAdminDirectoryUser[];workspaces?:OriginalAdminDirectoryWorkspace[];roles?:AdminRoleAssignment[];tenants?:Tenant[];creationTenant?:Tenant|null};
  target?: {user:AdminUser;sessions:AdminSession[];number:OriginalAdminNumber};
  workspaceNumbers: OriginalWorkspaceNumberRecord[]; workspaceCounter: string;
};
export type OriginalAdminSessionEffect = {
  value?: OriginalAdminAccessSet; error?: FirstSliceError;
  user?: AdminUser; sessions?: AdminSession[];
  createdUser?:AdminUser; adminNumbers?:OriginalAdminNumber[]; directoryJson?:string;
  targetUser?:AdminUser; targetSessions?:AdminSession[]; attempt?: AdminLoginAttempt; audit?: AdminAuditEvent;
  number?: OriginalAdminNumber; counter?: string;
  workspaceNumbers?: OriginalWorkspaceNumberRecord[]; workspaceCounter?: string;
  workspaceChange?: {kind:'create'|'rename';tenant:Tenant;workspace:Workspace;createTenant?:boolean};
  roleChanges?: {scope:{kind:'user';adminUserId:string}|{kind:'workspace';tenantId:string;workspaceId:string};removeIds:string[];assignments:AdminRoleAssignment[]};
  audits?:AdminAuditEvent[];
};
export type OriginalAdminSessionRepository = {
  /** The callback is synchronous and receives only this actor's metadata.
   * Verification, counters, token replacement and audit share one durable commit. */
  mutateOriginalAdminSession(selector: OriginalAdminSelector,
    transform: (snapshot: OriginalAdminSessionSnapshot) => OriginalAdminSessionEffect): Promise<OriginalAdminSessionEffect>;
};
export type OriginalAdminSessionPort = {
  login(input: {name: string; password: string}): Promise<OriginalAdminAccessSet>;
  read(input: {token: string}): Promise<OriginalAdminAccessSet>;
  logout(input: {token: string}): Promise<void>;
  recognizes(token: string): Promise<boolean>;
  authorize(input:{token:string;superAdmin?:boolean;adminNumber?:string}):Promise<void>;
  changePassword(input:{token:string;adminNumber:string;password:string;oldPassword?:string}):Promise<OriginalAdminAccessSet|undefined>;
};

const invalid = () => new FirstSliceError(403, 'original_admin_session_invalid', 'Invalid token.');
export function selectOriginalAdminIdentity(names: Array<{adminUserId: string; username: string}>, name: string): string | null {
  const matches = names.filter(row => originalParticipantGroupKeysEqual(row.username, name));
  if (matches.length > 1) throw new FirstSliceError(409, 'original_admin_identity_ambiguous', 'The native administrator identity is ambiguous.');
  return matches[0]?.adminUserId ?? null;
}
export function assertOriginalAdminNameAvailable(user:Pick<AdminUser,'adminUserId'|'username'>,previous:Pick<AdminUser,'username'>|null,names:Array<Pick<AdminUser,'adminUserId'|'username'>>):void {
  // Historical ambiguous names remain editable; new names cannot create a
  // collision between canonical normalization and native stored spelling.
  if(previous?.username===user.username)return;
  if(names.some(other=>other.adminUserId!==user.adminUserId&&originalParticipantGroupKeysEqual(other.username,user.username)))throw new FirstSliceError(409,'admin_username_conflict',`Admin username '${user.username}' already exists.`);
}
// All case/collation aliases of a real account share its existing canonical
// failure bucket; a native spelling must not bypass canonical failure limits.
export const originalAdminFailureBucket = (name: string): string => name.trim().toLowerCase();
export function originalAdminMetadataAllowed(s:{user:Pick<AdminUser,'adminUserId'|'status'|'validFrom'|'validTo'|'validForMinutes'|'firstSignedInAt'>|null;sessions:Array<Pick<AdminSession,'token'|'adminUserId'|'revokedAt'|'expiresAt'>>},selector:OriginalAdminSelector):boolean {
  if(!('token' in selector)||!selector.at||!s.user||s.user.status!=='active')return false;
  const at=Date.parse(selector.at),session=s.sessions.find(row=>row.token===selector.token&&row.adminUserId===s.user!.adminUserId);
  const limits=[s.user.validTo?Date.parse(s.user.validTo):Infinity,s.user.validForMinutes&&s.user.firstSignedInAt?Date.parse(s.user.firstSignedInAt)+s.user.validForMinutes*60_000:Infinity];
  return Number.isFinite(at)&&Boolean(session&&session.revokedAt===null&&Date.parse(session.expiresAt)>at)&&(!s.user.validFrom||Date.parse(s.user.validFrom)<=at)&&limits.every(limit=>limit>at);
}
export function originalAdminNumber(value: string, zero = false): bigint {
  if (typeof value !== 'string' || !/^(?:0|[1-9][0-9]{0,18})$/.test(value)) throw Error('Invalid native administrator number.');
  const number = BigInt(value);
  if (number > 9223372036854775807n || (!zero && number === 0n)) throw Error('Invalid native administrator number.');
  return number;
}
export function prepareOriginalAdminNumber(user: Pick<AdminUser,'adminUserId'>, previous: OriginalAdminNumber | null, counter: string): {number: OriginalAdminNumber; counter: string} {
  const current = originalAdminNumber(counter, true);
  if (previous) {
    if (previous.adminUserId !== user.adminUserId || originalAdminNumber(previous.adminNumber) > current) throw Error('Invalid native administrator number ownership.');
    return {number: {...previous}, counter};
  }
  if (current === 9223372036854775807n) throw Error('Native administrator number space is exhausted.');
  const next = (current + 1n).toString();
  return {number: {adminUserId: user.adminUserId, adminNumber: next}, counter: next};
}
/** Keep PHP's signed-int64 JSON token exact, rather than rounding through Number. */
export function formatOriginalAdminAccessSet(value: OriginalAdminAccessSet): string {
  originalAdminNumber(value.id);
  return '{' + Object.entries(value).map(([key, item]) => encodeOriginalReportJson(key) + ':' +
    (key === 'id' ? value.id : encodeOriginalReportJson(item))).join(',') + '}';
}

export function createOriginalAdminSessionPort(input: {
  repository: OriginalAdminSessionRepository & {getAdminSessionByToken(token: string): Promise<AdminSession | null>}; now: () => string; id: () => string;
  verifyPassword: (password: string, hash: string) => boolean;
  accessFailure: (user: AdminUser, now: string) => string | null;
  accessUntil: (user: AdminUser) => string | null;
  sessionTtlMs: number; maxFailures: number; failureWindowMs: number;
  validatePassword:(password:string)=>string;hashPassword:(password:string)=>string;
}): OriginalAdminSessionPort {
  const audit = (eventType: AdminAuditEvent['eventType'], user: AdminUser | null, timestamp: string, details: Record<string, unknown>): AdminAuditEvent => ({
    adminAuditEventId: input.id(), eventType, actorAdminUserId: eventType === 'admin_sign_in_failed' ? null : user?.adminUserId ?? null,
    subjectAdminUserId: user?.adminUserId ?? null, occurredAt: timestamp, summary: 'Native administrator session ' + eventType, details
  });
  const active = (s: OriginalAdminSessionSnapshot, token: string, timestamp: string): AdminSession => {
    const session = s.sessions.find(row => row.token === token);
    if (!s.user || s.user.status !== 'active' || !session || session.adminUserId !== s.user.adminUserId ||
      session.revokedAt !== null || Date.parse(session.expiresAt) <= Date.parse(timestamp) || input.accessFailure(s.user, timestamp)) throw invalid();
    return session;
  };
  const superAdmin=(s:OriginalAdminSessionSnapshot)=>s.roles.some(r=>r.adminUserId===s.user?.adminUserId&&r.role==='platform_admin');
  const authorize=(s:OriginalAdminSessionSnapshot,request:{token:string;superAdmin?:boolean;adminNumber?:string})=>{
    active(s,request.token,input.now());
    if(request.superAdmin&&!superAdmin(s))throw new FirstSliceError(403,'original_super_admin_required','Only SuperAdmins can do that!');
    if(request.adminNumber!==undefined&&request.adminNumber!==s.number?.adminNumber&&!superAdmin(s))throw new FirstSliceError(500,'original_admin_not_self','User is neither owner nor super admin');
  };
  const expires = (user: AdminUser, timestamp: string): string => new Date(Math.min(
    Date.parse(timestamp) + Math.min(input.sessionTtlMs, 600 * 60_000),
    input.accessUntil(user) ? Date.parse(input.accessUntil(user)!) : Infinity)).toISOString();
  const accessSet = (s: OriginalAdminSessionSnapshot, user: AdminUser, token: string): Pick<OriginalAdminSessionEffect, 'value' | 'number' | 'counter' | 'workspaceNumbers' | 'workspaceCounter'> => {
    const identity = prepareOriginalAdminNumber(user, s.number, s.counter);
    const workspaces: OriginalAdminAccessSet['claims']['workspaceAdmin'] = [];
    const numbers: OriginalWorkspaceNumberRecord[] = [];
    let workspaceCounter = s.workspaceCounter;
    const seen = new Set<string>();
    for (const role of s.roles) {
      if (role.adminUserId !== user.adminUserId || !isOriginalWorkspaceMembership(role) || !role.tenantId || !role.workspaceId || seen.has(role.workspaceId)) continue;
      const workspace = s.workspaces.find(w => w.workspaceId === role.workspaceId && w.tenantId === role.tenantId && w.status === 'active');
      if (!workspace || !s.tenants.some(t => t.tenantId === workspace.tenantId && t.status === 'active')) continue;
      seen.add(workspace.workspaceId);
      const prepared = prepareOriginalWorkspaceNumber(workspace, workspace, s.workspaceNumbers.find(row => row.workspaceId === workspace.workspaceId), workspaceCounter);
      workspaceCounter = prepared.counter;
      if (prepared.changed) numbers.push(prepared.record);
      const rw = s.roles.some(r => r.adminUserId === user.adminUserId && r.role === 'workspace_admin' && r.workspaceId === workspace.workspaceId &&
        r.tenantId === workspace.tenantId && (r.accessMode === undefined || r.accessMode === 'read_write'));
      workspaces.push({id: prepared.record.workspaceNumber, type: 'workspaceAdmin', label: workspace.displayName, flags: {mode: role.role==='native_workspace_opaque'?originalWorkspaceRoleValue(role):rw?'RW':'RO'}});
    }
    const claims: OriginalAdminAccessSet['claims'] = {workspaceAdmin: workspaces};
    const access: OriginalAdminAccessSet['access'] = {workspaceAdmin: workspaces.map(w => w.id)};
    if (s.roles.some(role => role.adminUserId === user.adminUserId && role.role === 'platform_admin')) {claims.superAdmin = []; access.superAdmin = [];}
    return {...identity, workspaceNumbers: numbers, workspaceCounter,
      value: {token, displayName: user.username, loginName: user.username, groupLabel: null, id: identity.number.adminNumber,
        pwSetByAdmin: user.passwordChangeRequired, customTexts: {}, flags: [], claims, groupToken: null, viewSettings: [], access}};
  };
  const mutate = async (selector: OriginalAdminSelector, transform: (s: OriginalAdminSessionSnapshot) => OriginalAdminSessionEffect) => {
    const effect = await input.repository.mutateOriginalAdminSession(selector, transform);
    if (effect.error) throw effect.error;
    return effect.value;
  };
  return {
    recognizes: async token => (await input.repository.getAdminSessionByToken(token)) !== null,
    async authorize(request){await mutate({token:request.token,at:input.now()},s=>{authorize(s,request);return{};});},
    async changePassword(request){
      return mutate({token:request.token,at:input.now(),targetAdminNumber:request.adminNumber},s=>{
        authorize(s,request);const self=s.number?.adminNumber===request.adminNumber,timestamp=input.now();
        if(self){
          if(request.oldPassword===undefined)throw new FirstSliceError(400,'original_old_password_required','Provide your current password (oldPassword) for security reasons!');
          if(typeof request.oldPassword!=='string')throw new FirstSliceError(500,'original_password_malformed','Internal error.');
          if(!input.verifyPassword(request.oldPassword,s.user!.passwordHash))throw new FirstSliceError(403,'original_old_password_invalid','Invalid current password for user '+request.adminNumber);
        }
        if(typeof request.password!=='string')throw new FirstSliceError(500,'original_password_malformed','Internal error.');
        const password=input.validatePassword(request.password);
        if(Buffer.byteLength(password)>60)throw new FirstSliceError(400,'original_password_too_long','Password too long');
        if(!s.target)return{};
        const updated={...s.target.user,passwordHash:input.hashPassword(password),passwordChangeRequired:!self||superAdmin(s)};
        const revoked=s.target.sessions.map(row=>row.revokedAt===null?{...row,revokedAt:timestamp}:row);
        const event=audit(self?'admin_password_changed':'admin_password_reset',s.user,timestamp,{native:true,targetAdminNumber:request.adminNumber});event.subjectAdminUserId=updated.adminUserId;
        if(!self)return{targetUser:updated,targetSessions:revoked,audit:event};
        const token=createOriginalSessionToken(),session:AdminSession={adminSessionId:input.id(),adminUserId:updated.adminUserId,token,createdAt:timestamp,expiresAt:expires(updated,timestamp),revokedAt:null};
        return{...accessSet(s,updated,token),user:updated,sessions:[...revoked,session],audit:event};
      });
    },
    async login(request) {
      if (typeof request.name !== 'string' || Buffer.byteLength(request.name) === 0 || Buffer.byteLength(request.name) > 50 || typeof request.password !== 'string') {
        throw new FirstSliceError(500, 'original_admin_credentials_malformed', 'Internal error.');
      }
      return (await mutate({name: request.name}, s => {
        const timestamp = input.now(), nowMs = Date.parse(timestamp), user = s.user;
        const username = originalAdminFailureBucket(user?.username ?? request.name);
        if (s.attempt && s.attempt.failedAttempts >= input.maxFailures && Date.parse(s.attempt.expiresAt) > nowMs) {
          return {error: new FirstSliceError(429, 'admin_login_rate_limited', 'Too many login attempts'), audit: audit('admin_sign_in_failed', user, timestamp, {username, reason: 'admin_login_rate_limited'})};
        }
        if (!user || user.status !== 'active' || !input.verifyPassword(request.password, user.passwordHash)) {
          const attempt = {username, failedAttempts: !s.attempt || Date.parse(s.attempt.expiresAt) <= nowMs ? 1 : s.attempt.failedAttempts + 1,
            updatedAt: timestamp, expiresAt: new Date(nowMs + input.failureWindowMs).toISOString()};
          return {attempt, error: new FirstSliceError(400, 'original_admin_credentials_invalid', 'No login with this password.'),
            audit: audit('admin_sign_in_failed', user, timestamp, {username, failedAttempts: attempt.failedAttempts})};
        }
        const failure = input.accessFailure(user, timestamp);
        if (failure) return {error: new FirstSliceError(failure === 'admin_access_expired' ? 410 : 403, failure, 'Administrator access is unavailable.')};
        const signedIn = user.validForMinutes && !user.firstSignedInAt ? {...user, firstSignedInAt: timestamp} : user;
        const token = createOriginalSessionToken();
        const session: AdminSession = {adminSessionId: input.id(), adminUserId: user.adminUserId, token, createdAt: timestamp, expiresAt: expires(signedIn, timestamp), revokedAt: null};
        return {...accessSet(s, signedIn, token), user: signedIn, attempt:{username,failedAttempts:0,updatedAt:timestamp,expiresAt:timestamp},
          sessions: [...s.sessions.map(row => row.revokedAt === null ? {...row, revokedAt: timestamp} : row), session],
          audit: audit('admin_sign_in_succeeded', user, timestamp, {adminSessionId: session.adminSessionId, native: true})};
      }))!;
    },
    async read({token}) {
      return (await mutate({token}, s => {
        const timestamp = input.now(), session = active(s, token, timestamp), user = s.user!;
        return {...accessSet(s, user, token), sessions: s.sessions.map(row => row.adminSessionId === session.adminSessionId ? {...row, expiresAt: expires(user, timestamp)} : row)};
      }))!;
    },
    async logout({token}) {
      await mutate({token}, s => {
        const timestamp = input.now(), session = active(s, token, timestamp);
        return {sessions: s.sessions.map(row => row.adminSessionId === session.adminSessionId ? {...row, revokedAt: timestamp} : row),
          audit: audit('admin_sign_out', s.user, timestamp, {adminSessionId: session.adminSessionId, native: true})};
      });
    }
  };
}
