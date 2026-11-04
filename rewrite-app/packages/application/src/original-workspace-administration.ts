import type {AdminRoleAssignment,Tenant,Workspace} from '@testcenter-rewrite-app/domain';
import type {FirstSliceRepository,AdminAuthPort} from './index.js';
import type {OriginalWorkspaceNumberRecord} from './original-workspace-number.js';
import type {OriginalTestSelection} from './original-test-deletion.js';
import {FirstSliceError} from './first-slice-error.js';
import {originalCommandInteger,originalCommandFloatString} from './original-command-codec.js';
import {OriginalPhpNumber,OriginalPhpObject} from './original-test-log-json.js';
import {originalOpaqueWorkspaceRole} from './original-workspace-role.js';

export type OriginalWorkspaceAdministrationScope={tenantId:string;workspaceId:string;tenantKey:string;workspaceKey:string};
export type OriginalWorkspaceAdministrationPort={context(input:{token:string;tenantKey:string;workspaceKey:string}):Promise<{workspaceId:string;role:'RO'|'RW'}>;resolve(input:{token:string;workspacePathSegment:string;write:boolean}):Promise<OriginalWorkspaceAdministrationScope>;delete(input:{token:string;workspacePathSegment:string;kind:'groups'|'tests';body:unknown}):Promise<void>};
type Collection<T>=Map<string,T>|Record<string,T>;
const values=<T>(rows:Collection<T>):T[]=>rows instanceof Map?[...rows.values()]:Object.values(rows);
const internal=()=>new FirstSliceError(500,'original_workspace_request_invalid','Internal error.');
/** Read one owned scope inventory; reverse lookup never allocates or guesses IDs. */
export function readOriginalWorkspaceAdministrationCollection(state:{originalWorkspaceNumbers?:Collection<OriginalWorkspaceNumberRecord>;workspacesByScope:Collection<Workspace>;tenants:Collection<Tenant>},workspaceNumber:string):OriginalWorkspaceAdministrationScope|null {
  const mappings=values(state.originalWorkspaceNumbers??{}).filter(n=>n.workspaceNumber===workspaceNumber);
  if(mappings.length>1)throw new FirstSliceError(409,'original_workspace_history_unknown','The native workspace identity is ambiguous.');
  const n=mappings[0];if(!n)return null;
  const workspaces=values(state.workspacesByScope).filter(w=>w.workspaceId===n.workspaceId&&w.tenantId===n.tenantId&&w.status==='active');
  const tenants=values(state.tenants).filter(t=>t.tenantId===n.tenantId&&t.status==='active');
  if(workspaces.length!==1||tenants.length!==1)return null;
  return {tenantId:n.tenantId,workspaceId:n.workspaceId,tenantKey:tenants[0]!.tenantKey,workspaceKey:workspaces[0]!.workspaceKey};
}
/** Source casts its path to PHP int, including numeric prefixes/exponents and
 * saturating integer strings. Reuse the Source67-qualified Zend conversion. */
export function parseOriginalWorkspaceNumber(reference:string):string|null {
  const value=originalCommandInteger(reference);return value>0n?value.toString():null;
}
export function originalExplicitWorkspaceAccess(roles:Array<Pick<AdminRoleAssignment,'adminUserId'|'role'|'tenantId'|'workspaceId'|'accessMode'>>,adminUserId:string,scope:OriginalWorkspaceAdministrationScope):'RO'|'RW'|null {
  const selected=roles.filter(r=>r.adminUserId===adminUserId&&r.role==='workspace_admin'&&r.tenantId===scope.tenantId&&r.workspaceId===scope.workspaceId);
  if(selected.some(r=>r.accessMode===undefined||r.accessMode==='read_write'))return 'RW';
  return selected.some(r=>r.accessMode==='read_only')?'RO':null;
}
export function createOriginalWorkspaceAdministrationPort(input:{repository:FirstSliceRepository;now:()=>string;admin:(token:string)=>ReturnType<AdminAuthPort['getCurrentSession']>}):OriginalWorkspaceAdministrationPort {
  const port:OriginalWorkspaceAdministrationPort={async context(request){
    // Bridge the shell's canonical scope to its persisted native identity. Never
    // infer this association from labels, list order, or a JavaScript Number.
    const actor=await input.admin(request.token);
    const tenant=await input.repository.getTenantByKey(request.tenantKey);
    const workspace=await input.repository.getWorkspaceByScope(request.tenantKey,request.workspaceKey);
    const scope=tenant?.status==='active'&&workspace?.status==='active'&&workspace.tenantId===tenant.tenantId
      ?{tenantId:tenant.tenantId,workspaceId:workspace.workspaceId,tenantKey:request.tenantKey,workspaceKey:request.workspaceKey}:null;
    const role=scope?originalExplicitWorkspaceAccess(actor.roleAssignments,actor.adminUser.adminUserId,scope):null;
    if(!scope||!role)throw new FirstSliceError(404,'original_workspace_not_found','Workspace not found.');
    const workspaceId=await input.repository.getOrCreateOriginalWorkspaceNumber(scope);
    // Allocation may wait for a durable writer. Recheck current authority and
    // active parents after that wait; this reply is a locator, never a grant.
    const current=await port.resolve({token:request.token,workspacePathSegment:workspaceId,write:false});
    if(current.tenantId!==scope.tenantId||current.workspaceId!==scope.workspaceId)throw internal();
    const refreshed=await input.admin(request.token);
    const currentRole=originalExplicitWorkspaceAccess(refreshed.roleAssignments,refreshed.adminUser.adminUserId,current);
    if(!currentRole)throw new FirstSliceError(404,'original_workspace_not_found','Workspace not found.');
    return {workspaceId,role:currentRole};
  },async resolve(request){
    let actor:Awaited<ReturnType<AdminAuthPort['getCurrentSession']>>;
    try{actor=await input.admin(request.token);}catch(error){
      if(error instanceof FirstSliceError&&error.statusCode===401)throw new FirstSliceError(403,'original_admin_token_invalid','Invalid admin token.');
      throw error;
    }
    let reference:string;try{reference=decodeURIComponent(request.workspacePathSegment);}catch{throw new FirstSliceError(404,'original_workspace_invalid','No valid workspace.');}
    const number=parseOriginalWorkspaceNumber(reference);
    if(number===null)throw new FirstSliceError(404,'original_workspace_invalid','No valid workspace: `'+reference+'`');
    const scope=await input.repository.findOriginalWorkspaceAdministrationScope(number);
    const role=scope?originalExplicitWorkspaceAccess(actor.roleAssignments,actor.adminUser.adminUserId,scope):null;
    const opaque=scope&&!role?originalOpaqueWorkspaceRole(actor.roleAssignments,actor.adminUser.adminUserId,scope):null;
    if(opaque!==null)throw new FirstSliceError(403,'original_workspace_opaque_role','Access Denied: Role `'+(request.write?'RW':'RO')+'` on workspace `ws_'+reference+'`, needed. Only `'+opaque+'` provided.');
    if(!scope||!role)throw new FirstSliceError(404,'original_workspace_not_found','Workspace `'+reference+'` not found.');
    if(request.write&&role!=='RW')throw new FirstSliceError(403,'original_workspace_read_only','Access Denied: Role `RW` on workspace `ws_'+reference+'`, needed. Only `RO` provided.');
    return scope;
  },async delete(request){
    const scope=await port.resolve({...request,write:true}),authority={token:request.token,tenantId:scope.tenantId,workspaceId:scope.workspaceId,now:input.now};
    const result=request.kind==='groups'?await input.repository.deleteOriginalGroupResults({...scope,groups:prepareOriginalNativeGroupSelection(request.body),authority})
      :await input.repository.deleteOriginalSelectedTests({...scope,personSessions:prepareOriginalNativeTestSelection(request.body),authority});
    if(!result)throw new FirstSliceError(404,'original_workspace_not_found','Workspace not found.');
  }};
  return port;
}
const field=(body:unknown,key:string):unknown=>body instanceof OriginalPhpObject?body.fields.get(key):body&&typeof body==='object'&&!Array.isArray(body)&&Object.hasOwn(body,key)?(body as Record<string,unknown>)[key]:undefined;
const required=(body:unknown,key:string):unknown=>{const value=field(body,key);if(value==null)throw new FirstSliceError(400,'original_request_invalid','Required body-parameter is missing: `'+key+'`');return value;};
/** Source PDO binds these untyped tuple values as text, with first-NUL truncation.
 * JSON integers retain their PHP signed64 token; objects fail before mutation. */
function pdoText(value:unknown):string {
  if(value instanceof OriginalPhpNumber)return value.integer?.toString()??originalCommandFloatString(value.value);
  if(value==null||value===false)return '';if(value===true)return '1';
  if(typeof value==='string')return value.split('\0',1)[0]!;
  if(typeof value==='number')return Number.isSafeInteger(value)?String(value):originalCommandFloatString(value);
  if(Array.isArray(value))return 'Array';throw internal();
}
export function prepareOriginalNativeTestSelection(body:unknown):OriginalTestSelection[] {
  const rows=field(body,'personSessions');
  if(!Array.isArray(rows))throw new FirstSliceError(400,'original_request_invalid','body has to be an array');
  if(!rows.length)throw new FirstSliceError(400,'original_request_invalid','sets to be deleted must be a non-empty array');
  // Source extracts every required fieldset before the DAO binds any value.
  // A later missing required field therefore wins over an earlier object value.
  const selected=rows.map(row=>({loginName:required(row,'loginName'),code:field(row,'code')??'',nameSuffix:field(row,'nameSuffix')??'',bookletName:required(row,'bookletName')}));
  return selected.map(row=>({loginName:pdoText(row.loginName),code:pdoText(row.code),nameSuffix:pdoText(row.nameSuffix),bookletName:pdoText(row.bookletName)}));
}
export function prepareOriginalNativeGroupSelection(body:unknown):string[] {
  const groups=required(body,'groups');
  const selected=Array.isArray(groups)?groups:groups instanceof OriginalPhpObject?[...groups.fields.values()]:groups&&typeof groups==='object'?Object.values(groups):null;
  if(!selected||selected.some(value=>typeof value!=='string'))throw internal();
  return selected as string[];
}
