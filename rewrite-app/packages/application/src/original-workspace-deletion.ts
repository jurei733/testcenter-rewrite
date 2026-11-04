import type {Tenant,Workspace} from '@testcenter-rewrite-app/domain';
import {FirstSliceError} from './first-slice-error.js';
import {OriginalPhpObject} from './original-test-log-json.js';
import {originalAdministrationDeletionId} from './original-administration-deletion-id.js';
import {originalAdminMetadataAllowed,originalAdminNumber,type OriginalAdminSelector,type OriginalAdminSessionSnapshot,type OriginalAdminSessionEffect,type OriginalAdminSessionRepository} from './original-admin-session.js';

export type OriginalWorkspaceDeletionTarget={tenant:Tenant;workspace:Workspace;workspaceNumber:string};
export type OriginalWorkspaceDeletionPort={deleteWorkspaces(input:{token:string;body:unknown}):Promise<void>};
const field=(body:unknown,key:string):unknown=>body instanceof OriginalPhpObject?body.fields.get(key):
 body&&typeof body==='object'&&!Array.isArray(body)&&Object.hasOwn(body,key)?(body as Record<string,unknown>)[key]:undefined;
const unavailable=()=>new FirstSliceError(409,'original_workspace_directory_unavailable','The native workspace directory is unavailable.');
const same=(a:Tenant|Workspace,b:Tenant|Workspace)=>Object.keys(a).length===Object.keys(b).length&&Object.entries(a).every(([key,v])=>v===(b as unknown as Record<string,unknown>)[key]);

/** Authorize immutable storage metadata before any collection, sidecar, SQL
 * row or audit changes. Neither labels nor callback-edited IDs recover scope. */
export function validateOriginalWorkspaceDeletionEffect(s:OriginalAdminSessionSnapshot,e:OriginalAdminSessionEffect,selector:OriginalAdminSelector):void {
 const targets=e.deletedWorkspaces;if(!targets)return;
 if(!('token' in selector)||selector.directory!=='workspaces'||selector.workspaceWrite!=='delete'||
  !originalAdminMetadataAllowed(s,selector)||!s.roles.some(r=>r.role==='platform_admin'))throw Error('Native workspace deletion authorization changed.');
 if(Object.keys(e).some(key=>!['deletedWorkspaces','directoryJson','audits'].includes(key))||e.directoryJson!==''||!targets.length||e.audits?.length!==targets.length||
  new Set(targets.map(t=>t.workspace.workspaceId)).size!==targets.length||new Set(targets.map(t=>t.workspaceNumber)).size!==targets.length)throw Error('Native workspace deletion effect changed.');
 targets.forEach((target,index)=>{
  const {workspace:w,tenant:t,workspaceNumber:n}=target,old=s.directory?.workspaces?.find(row=>row.workspace.workspaceId===w.workspaceId),parent=s.directory?.tenants?.find(row=>row.tenantId===t.tenantId),a=e.audits![index]!;
  if(!old||!parent||old.workspaceNumber!==n||w.tenantId!==t.tenantId||w.status!=='active'||t.status!=='active'||!same(w,old.workspace)||!same(t,parent))throw Error('Native workspace deletion target changed.');
  originalAdminNumber(n);
  if(a.eventType!=='workspace_deleted'||a.actorAdminUserId!==s.user?.adminUserId||a.subjectAdminUserId!==null||a.details.native!==true||a.details.tenantId!==t.tenantId||
   a.details.workspaceId!==w.workspaceId||a.details.workspaceNumber!==n||!Number.isFinite(Date.parse(a.occurredAt)))throw Error('Native workspace deletion audit changed.');
 });
}
export function createOriginalWorkspaceDeletionPort(input:{repository:OriginalAdminSessionRepository;now:()=>string;id:()=>string;verifyPassword:(password:string,hash:string)=>boolean}):OriginalWorkspaceDeletionPort {
 return{deleteWorkspaces:async request=>{
  const effect=await input.repository.mutateOriginalAdminSession({token:request.token,at:input.now(),directory:'workspaces',workspaceWrite:'delete'},s=>{
   if(!originalAdminMetadataAllowed(s,{token:request.token,at:input.now()}))throw new FirstSliceError(403,'original_admin_session_invalid','Invalid token.');
   if(!s.roles.some(r=>r.role==='platform_admin'))throw new FirstSliceError(403,'original_super_admin_required','Only SuperAdmins can do that!');
   // Unlike DELETE /users, Source checks the workspace collection BEFORE the
   // confirmation password. Decode all IDs before constructing any effect.
   const values=field(request.body,'ws')??[];
   if(!Array.isArray(values))throw new FirstSliceError(400,'original_workspace_deletion_list_invalid','Bad request.');
   const password=field(request.body,'p');
   if(password===undefined||password===null)throw new FirstSliceError(400,'original_confirmation_password_missing','Provide Password for security reasons!');
   if(typeof password!=='string')throw new FirstSliceError(500,'original_confirmation_password_invalid','Internal error.');
   if(!s.number)throw unavailable();originalAdminNumber(s.number.adminNumber);
   if(!input.verifyPassword(password,s.user!.passwordHash))throw new FirstSliceError(403,'original_confirmation_password_incorrect','Invalid password for user '+s.number.adminNumber);
   if(!s.directory?.workspaces||!s.directory.tenants)throw unavailable();
   const targets:OriginalWorkspaceDeletionTarget[]=[];
   for(const reference of new Set(values.map(originalAdministrationDeletionId))){
    if(reference===null)continue;
    const matches=s.directory.workspaces.filter(row=>row.workspaceNumber===reference);if(matches.length>1)throw unavailable();
    const target=matches[0];if(!target)continue;
    const tenant=s.directory.tenants.find(t=>t.tenantId===target.workspace.tenantId);if(!tenant||target.workspaceNumber===null)throw unavailable();originalAdminNumber(target.workspaceNumber);
    targets.push({workspace:target.workspace,tenant,workspaceNumber:target.workspaceNumber});
   }
   if(!targets.length)return{directoryJson:''};
   const timestamp=input.now();
   return{deletedWorkspaces:targets,directoryJson:'',audits:targets.map(({workspace:w,tenant:t,workspaceNumber:n})=>({adminAuditEventId:input.id(),eventType:'workspace_deleted' as const,
    actorAdminUserId:s.user!.adminUserId,subjectAdminUserId:null,occurredAt:timestamp,summary:'Native workspace deleted',details:{native:true,tenantId:t.tenantId,workspaceId:w.workspaceId,workspaceNumber:n}}))};
  });
  if(effect.error)throw effect.error;if(effect.directoryJson!=='')throw Error('Missing native workspace deletion result.');
 }};
}
