import type {DatabaseSync} from 'node:sqlite';
import {deriveOriginalWorkspaceContentType,projectOriginalWorkspaceFile,type OriginalSystemCheckDirectorySnapshot} from '@testcenter-rewrite-app/application';
import type {SourcePackage,WorkspaceActivityEvent} from '@testcenter-rewrite-app/domain';
type Row=Record<string,unknown>;
export type ContentMappers={source:(row:Row|undefined)=>SourcePackage|null;event:(row:Row|undefined)=>WorkspaceActivityEvent|null};
const present=<Value>(value:Value|null):value is Value=>value!==null;
const files=(db:DatabaseSync,map:ContentMappers,tenantId:string,workspaceId:string)=>({
 sourcePackages:db.prepare('SELECT * FROM source_packages WHERE tenant_id=? AND workspace_id=?').all(tenantId,workspaceId).map(map.source).filter(present),
 activityEvents:db.prepare('SELECT * FROM workspace_activity_events WHERE tenant_id=? AND workspace_id=?').all(tenantId,workspaceId).map(map.event).filter(present)
});
/** Caller owns the same write transaction as the physical catalog mutation. */
export function refreshOriginalWorkspaceContentType(db:DatabaseSync,map:ContentMappers,tenantId:string,workspaceId:string):void{
 const type=deriveOriginalWorkspaceContentType(files(db,map,tenantId,workspaceId),projectOriginalWorkspaceFile);
 db.prepare('UPDATE workspaces SET original_content_type=? WHERE tenant_id=? AND workspace_id=?').run(type,tenantId,workspaceId);
}
export function readOriginalSystemCheckDirectory(db:DatabaseSync,map:ContentMappers):OriginalSystemCheckDirectorySnapshot{
 db.exec('BEGIN');
 try{
  const active=db.prepare("SELECT w.*,n.workspace_number FROM workspaces w JOIN tenants t ON t.tenant_id=w.tenant_id LEFT JOIN original_workspace_numbers n ON n.workspace_id=w.workspace_id AND n.tenant_id=w.tenant_id WHERE w.status='active' AND t.status='active'").all();
  const result={mode:active.some(row=>row.original_content_type==='sysCheck'),workspaces:active.filter(row=>row.workspace_number!=null).map(row=>({workspaceNumber:String(row.workspace_number),...files(db,map,String(row.tenant_id),String(row.workspace_id))}))};
  db.exec('COMMIT');return result;
 }catch(error){db.exec('ROLLBACK');throw error;}
}
