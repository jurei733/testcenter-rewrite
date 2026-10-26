import type {PoolClient} from 'pg';
import type {Workspace} from '@testcenter-rewrite-app/domain';
import {prepareOriginalWorkspaceNumber,type OriginalWorkspaceNumberScope} from '@testcenter-rewrite-app/application';
export async function allocateOriginalWorkspaceNumber(client:PoolClient,input:OriginalWorkspaceNumberScope,workspace:Workspace|null):Promise<string>{
 const counter=(await client.query('SELECT last_number FROM original_workspace_number_counter WHERE singleton=1 FOR UPDATE')).rows[0];
 const row=(await client.query('SELECT * FROM original_workspace_numbers WHERE workspace_id=$1',[input.workspaceId])).rows[0];
 const existing=row?{tenantId:String(row.tenant_id),workspaceId:String(row.workspace_id),workspaceNumber:String(row.workspace_number)}:undefined;
 const result=prepareOriginalWorkspaceNumber(input,workspace,existing,String(counter?.last_number));
 if(result.changed){await client.query('UPDATE original_workspace_number_counter SET last_number=$1 WHERE singleton=1',[result.counter]);await client.query('INSERT INTO original_workspace_numbers(workspace_number,workspace_id,tenant_id) VALUES($1,$2,$3)',[result.record.workspaceNumber,input.workspaceId,input.tenantId]);}
 return result.record.workspaceNumber;
}
