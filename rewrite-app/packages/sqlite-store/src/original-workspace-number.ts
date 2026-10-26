import type {DatabaseSync} from 'node:sqlite';
import type {Workspace} from '@testcenter-rewrite-app/domain';
import {prepareOriginalWorkspaceNumber,type OriginalWorkspaceNumberScope} from '@testcenter-rewrite-app/application';
export function allocateOriginalWorkspaceNumber(database:DatabaseSync,input:OriginalWorkspaceNumberScope,workspace:Workspace|null):string{
 const row=database.prepare('SELECT * FROM original_workspace_numbers WHERE workspace_id=?').get(input.workspaceId);
 const counter=database.prepare('SELECT last_number FROM original_workspace_number_counter WHERE singleton=1').get();
 const existing=row?{tenantId:String(row.tenant_id),workspaceId:String(row.workspace_id),workspaceNumber:String(row.workspace_number)}:undefined;
 const result=prepareOriginalWorkspaceNumber(input,workspace,existing,String(counter?.last_number));
 if(result.changed){database.prepare('UPDATE original_workspace_number_counter SET last_number=? WHERE singleton=1').run(result.counter);database.prepare('INSERT INTO original_workspace_numbers(workspace_number,workspace_id,tenant_id) VALUES(?,?,?)').run(result.record.workspaceNumber,input.workspaceId,input.tenantId);}
 return result.record.workspaceNumber;
}
