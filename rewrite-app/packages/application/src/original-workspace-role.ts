import type {AdminRoleAssignment} from '@testcenter-rewrite-app/domain';
import {FirstSliceError} from './first-slice-error.js';

type Role=Pick<AdminRoleAssignment,'role'|'accessMode'|'nativeWorkspaceRole'>;
export const isOriginalWorkspaceMembership=(role:Pick<Role,'role'>):boolean=>role.role==='workspace_admin'||role.role==='native_workspace_opaque';
/** A stored membership and an authorized role are deliberately distinct. */
export function originalWorkspaceRoleValue(role:Role):string {
 if(role.role==='workspace_admin')return role.accessMode==='read_only'?'RO':'RW';
 const value=role.nativeWorkspaceRole;
 if(role.role!=='native_workspace_opaque'||typeof value!=='string'||value==='RO'||value==='RW'||value.includes('\0')||[...value].length>10||Buffer.from(value,'utf8').toString('utf8')!==value)
  throw new FirstSliceError(409,'original_workspace_role_history_invalid','Native workspace role history is invalid.');
 return value;
}
export function originalOpaqueWorkspaceRole(roles:Array<Pick<AdminRoleAssignment,'adminUserId'|'role'|'accessMode'|'nativeWorkspaceRole'|'tenantId'|'workspaceId'>>,adminUserId:string,scope:{tenantId:string;workspaceId:string}):string|null {
 const role=roles.find(r=>r.role==='native_workspace_opaque'&&r.adminUserId===adminUserId&&r.tenantId===scope.tenantId&&r.workspaceId===scope.workspaceId);
 return role?originalWorkspaceRoleValue(role):null;
}
