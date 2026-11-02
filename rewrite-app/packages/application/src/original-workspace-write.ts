import type {AdminUser,AdminSession,AdminRoleAssignment,Tenant,Workspace} from '@testcenter-rewrite-app/domain';
import {FirstSliceError} from './first-slice-error.js';
import {originalAdminMetadataAllowed} from './original-admin-session.js';
import {originalExplicitWorkspaceAccess} from './original-workspace-administration.js';

/** Server-owned authorization travels to the actual durable deletion boundary.
 * The clock is evaluated there, after any writer/row-lock wait. */
export type OriginalWorkspaceWriteAuthority={token:string;tenantId:string;workspaceId:string;now:()=>string};
export type OriginalWorkspaceWriteSnapshot={
 user:Pick<AdminUser,'adminUserId'|'status'|'passwordChangeRequired'|'validFrom'|'validTo'|'validForMinutes'|'firstSignedInAt'>|null;
 sessions:Array<Pick<AdminSession,'token'|'adminUserId'|'revokedAt'|'expiresAt'>>;
 roles:Array<Pick<AdminRoleAssignment,'adminUserId'|'role'|'tenantId'|'workspaceId'|'accessMode'>>;
 tenant:Pick<Tenant,'tenantId'|'status'>|null;workspace:Pick<Workspace,'tenantId'|'workspaceId'|'status'>|null;
};
export function assertOriginalWorkspaceWrite(scope:{tenantId:string;workspaceId:string},authority:OriginalWorkspaceWriteAuthority,s:OriginalWorkspaceWriteSnapshot):void{
 if(!originalAdminMetadataAllowed(s,{token:authority.token,at:authority.now()}))throw new FirstSliceError(403,'original_admin_token_invalid','Invalid admin token.');
 if(s.user!.passwordChangeRequired&&!s.roles.some(r=>r.adminUserId===s.user!.adminUserId&&r.role==='platform_admin')&&
  s.roles.some(r=>r.adminUserId===s.user!.adminUserId&&(r.role==='workspace_admin'||r.role==='tenant_admin')))
  throw new FirstSliceError(403,'admin_password_change_required','The administrator-set password must be changed before continuing.');
 if(authority.tenantId!==scope.tenantId||authority.workspaceId!==scope.workspaceId||s.tenant?.tenantId!==scope.tenantId||s.tenant.status!=='active'||
  s.workspace?.tenantId!==scope.tenantId||s.workspace.workspaceId!==scope.workspaceId||s.workspace.status!=='active')
  throw new FirstSliceError(404,'original_workspace_not_found','Workspace not found.');
 const access=originalExplicitWorkspaceAccess(s.roles,s.user!.adminUserId,{...scope,tenantKey:'',workspaceKey:''});
 if(!access)throw new FirstSliceError(404,'original_workspace_not_found','Workspace not found.');
 if(access!=='RW')throw new FirstSliceError(403,'original_workspace_read_only','Access Denied: Role `RW` on this workspace is needed. Only `RO` provided.');
}
type Rows<T>=Map<string,T>|Record<string,T>;
const values=<T>(rows:Rows<T>):T[]=>rows instanceof Map?[...rows.values()]:Object.values(rows);
export function guardOriginalWorkspaceWriteCollections(state:{adminUsers:Rows<AdminUser>;adminRoleAssignments:Rows<AdminRoleAssignment>;tenants:Rows<Tenant>;workspacesByScope:Rows<Workspace>},
 sessions:Rows<AdminSession>,input:{tenantId:string;workspaceId:string;authority?:OriginalWorkspaceWriteAuthority}):void{
 if(!input.authority)return;
 const session=values(sessions).find(s=>s.token===input.authority!.token),user=values(state.adminUsers).find(u=>u.adminUserId===session?.adminUserId)??null;
 assertOriginalWorkspaceWrite(input,input.authority,{user,sessions:session?[session]:[],roles:values(state.adminRoleAssignments).filter(r=>r.adminUserId===user?.adminUserId),
  tenant:values(state.tenants).find(t=>t.tenantId===input.tenantId)??null,workspace:values(state.workspacesByScope).find(w=>w.tenantId===input.tenantId&&w.workspaceId===input.workspaceId)??null});
}
/** Both SQL stores project only actor/scope metadata; never credentials or data. */
export function originalWorkspaceWriteSqlSnapshot(row:Record<string,unknown>|undefined,roles:Array<Record<string,unknown>>):OriginalWorkspaceWriteSnapshot{
 const text=(key:string)=>row?.[key]==null?null:String(row[key]);
 return {user:row?{adminUserId:String(row.admin_user_id),status:row.user_status as AdminUser['status'],passwordChangeRequired:Boolean(row.password_change_required),
  validFrom:text('valid_from'),validTo:text('valid_to'),validForMinutes:row.valid_for_minutes==null?null:Number(row.valid_for_minutes),firstSignedInAt:text('first_signed_in_at')}:null,
  sessions:row?[{token:String(row.session_token),adminUserId:String(row.admin_user_id),revokedAt:text('revoked_at'),expiresAt:String(row.expires_at)}]:[],
  roles:roles.map(r=>({adminUserId:String(r.admin_user_id),role:r.role as AdminRoleAssignment['role'],tenantId:r.tenant_id==null?null:String(r.tenant_id),workspaceId:r.workspace_id==null?null:String(r.workspace_id),accessMode:r.access_mode as AdminRoleAssignment['accessMode']})),
  tenant:row?{tenantId:String(row.tenant_id),status:row.tenant_status as Tenant['status']}:null,
  workspace:row?{tenantId:String(row.tenant_id),workspaceId:String(row.workspace_id),status:row.workspace_status as Workspace['status']}:null};
}
