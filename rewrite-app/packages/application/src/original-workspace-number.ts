import type {Workspace} from '@testcenter-rewrite-app/domain';
import {FirstSliceError} from './first-slice-error.js';
export type OriginalWorkspaceNumberScope=Pick<Workspace,'tenantId'|'workspaceId'>;
export type OriginalWorkspaceNumberRecord=OriginalWorkspaceNumberScope&{workspaceNumber:string};
export function prepareOriginalWorkspaceNumber(input:OriginalWorkspaceNumberScope,workspace:Workspace|null,existing:OriginalWorkspaceNumberRecord|undefined,counter:string){
  if(!workspace||workspace.tenantId!==input.tenantId||workspace.workspaceId!==input.workspaceId)throw new FirstSliceError(409,'original_workspace_scope_changed','The workspace is no longer available.');
  const decimal=(value:string)=>{if(typeof value!=='string'||!/^(?:0|[1-9][0-9]{0,18})$/.test(value)||BigInt(value)>9223372036854775807n)throw Error('Invalid persisted native workspace number.');return BigInt(value);};
  const current=decimal(counter);
  if(existing){if(existing.tenantId!==input.tenantId||existing.workspaceId!==input.workspaceId||decimal(existing.workspaceNumber)===0n||BigInt(existing.workspaceNumber)>current)throw Error('Invalid native workspace number scope.');return{record:{...existing},counter,changed:false};}
  if(current===9223372036854775807n)throw Error('Native workspace number space is exhausted.');
  const next=(current+1n).toString();return{record:{...input,workspaceNumber:next},counter:next,changed:true};
}
