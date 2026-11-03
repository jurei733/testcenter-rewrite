import type {PoolClient} from 'pg';
import {assertOriginalWorkspaceWrite,originalWorkspaceWriteSqlSnapshot,type OriginalWorkspaceWriteAuthority} from '@testcenter-rewrite-app/application';

export async function guardOriginalWorkspaceWrite(database:PoolClient,input:{tenantId:string;workspaceId:string;authority?:OriginalWorkspaceWriteAuthority}):Promise<void>{
 if(!input.authority)return;
 // The workspace parent is already locked by this deletion. Lock actor,
 // session, Tenant and grants until commit, including while child locks wait.
 const row=(await database.query('SELECT u.admin_user_id,u.status AS user_status,u.password_change_required,u.valid_from,u.valid_to,u.valid_for_minutes,u.first_signed_in_at,s.session_token,s.revoked_at,s.expires_at,w.tenant_id,w.workspace_id,w.status AS workspace_status,t.status AS tenant_status FROM admin_sessions s JOIN admin_users u ON u.admin_user_id=s.admin_user_id JOIN workspaces w ON w.tenant_id=$1 AND w.workspace_id=$2 JOIN tenants t ON t.tenant_id=w.tenant_id WHERE s.session_token=$3 FOR SHARE OF u,s,t',[input.tenantId,input.workspaceId,input.authority.token])).rows[0];
 const roles=row?(await database.query('SELECT admin_user_id,role,tenant_id,workspace_id,access_mode FROM admin_role_assignments WHERE admin_user_id=$1 FOR SHARE',[row.admin_user_id])).rows:[];
 assertOriginalWorkspaceWrite(input,input.authority,originalWorkspaceWriteSqlSnapshot(row,roles));
}
