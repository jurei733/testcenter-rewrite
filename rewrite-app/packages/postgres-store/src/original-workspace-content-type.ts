import type {Pool,PoolClient} from 'pg';
import {deriveOriginalWorkspaceContentType,projectOriginalWorkspaceFile,type OriginalSystemCheckDirectorySnapshot} from '@testcenter-rewrite-app/application';
import type {SourcePackage,WorkspaceActivityEvent} from '@testcenter-rewrite-app/domain';
type Row=Record<string,unknown>;
export type ContentMappers={source:(row:Row|undefined)=>SourcePackage|null;event:(row:Row|undefined)=>WorkspaceActivityEvent|null};
const present=<Value>(value:Value|null):value is Value=>value!==null;
const files=async(db:PoolClient,map:ContentMappers,tenantId:string,workspaceId:string)=>({
 sourcePackages:(await db.query('SELECT * FROM source_packages WHERE tenant_id=$1 AND workspace_id=$2',[tenantId,workspaceId])).rows.map(map.source).filter(present),
 activityEvents:(await db.query('SELECT * FROM workspace_activity_events WHERE tenant_id=$1 AND workspace_id=$2',[tenantId,workspaceId])).rows.map(map.event).filter(present)
});
/** Caller owns the workspace lock and the physical catalog transaction. */
export async function refreshOriginalWorkspaceContentType(db:PoolClient,map:ContentMappers,tenantId:string,workspaceId:string):Promise<void>{
 const type=deriveOriginalWorkspaceContentType(await files(db,map,tenantId,workspaceId),projectOriginalWorkspaceFile);
 await db.query('UPDATE workspaces SET original_content_type=$1 WHERE tenant_id=$2 AND workspace_id=$3',[type,tenantId,workspaceId]);
}
export async function readOriginalSystemCheckDirectory(pool:Pool,map:ContentMappers):Promise<OriginalSystemCheckDirectorySnapshot>{
 const db=await pool.connect();
 try{
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const active=(await db.query("SELECT w.*,n.workspace_number FROM workspaces w JOIN tenants t ON t.tenant_id=w.tenant_id LEFT JOIN original_workspace_numbers n ON n.workspace_id=w.workspace_id AND n.tenant_id=w.tenant_id WHERE w.status='active' AND t.status='active'")).rows;
  const workspaces=[];
  for(const row of active)if(row.workspace_number!=null)workspaces.push({workspaceNumber:String(row.workspace_number),...await files(db,map,String(row.tenant_id),String(row.workspace_id))});
  await db.query('COMMIT');return{mode:active.some(row=>row.original_content_type==='sysCheck'),workspaces};
 }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
}
