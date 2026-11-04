import type {DatabaseSync} from 'node:sqlite';
import {assertOriginalWorkspaceWrite,originalWorkspaceWriteSqlSnapshot,type OriginalWorkspaceWriteAuthority} from '@testcenter-rewrite-app/application';

export function guardOriginalWorkspaceWrite(database:DatabaseSync,input:{tenantId:string;workspaceId:string;authority?:OriginalWorkspaceWriteAuthority}):void{
 if(!input.authority)return;
 const row=database.prepare('SELECT u.admin_user_id,u.status AS user_status,u.password_change_required,u.valid_from,u.valid_to,u.valid_for_minutes,u.first_signed_in_at,s.session_token,s.revoked_at,s.expires_at,w.tenant_id,w.workspace_id,w.status AS workspace_status,t.status AS tenant_status FROM admin_sessions s JOIN admin_users u ON u.admin_user_id=s.admin_user_id JOIN workspaces w ON w.tenant_id=? AND w.workspace_id=? JOIN tenants t ON t.tenant_id=w.tenant_id WHERE s.session_token=?').get(input.tenantId,input.workspaceId,input.authority.token);
 const roles=row?database.prepare(`SELECT admin_user_id,role,tenant_id,workspace_id,access_mode,CASE WHEN role='native_workspace_opaque' THEN json_extract(monitor_profiles_json,'$.nativeWorkspaceRole') ELSE NULL END AS native_workspace_role FROM admin_role_assignments WHERE admin_user_id=?`).all(String(row.admin_user_id)):[];
 assertOriginalWorkspaceWrite(input,input.authority,originalWorkspaceWriteSqlSnapshot(row,roles));
}
