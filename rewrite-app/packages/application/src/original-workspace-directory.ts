import type {Tenant,Workspace} from '@testcenter-rewrite-app/domain';
import {FirstSliceError} from './first-slice-error.js';
import {originalCommandInteger} from './original-command-codec.js';
import {originalParticipantGroupKeysEqual} from './original-participant-group.js';
import {prepareOriginalWorkspaceNumber} from './original-workspace-number.js';
import {originalAdminMetadataAllowed,originalAdminNumber,type OriginalAdminSelector,type OriginalAdminSessionSnapshot,type OriginalAdminSessionEffect,type OriginalAdminSessionRepository} from './original-admin-session.js';
import {readOriginalWorkspaceName,originalWorkspaceNameParameter,originalWorkspaceStoredName} from './original-workspace-directory-name.js';

// Reuse the dedicated container used by the existing administration adapter.
// A native flat workspace must never inherit the last participant's tenant.
export const originalAdministrationWorkspaceTenantKey='original-interface';
const unavailable=()=>new FirstSliceError(409,'original_workspace_directory_unavailable','The native workspace directory is unavailable.');
const sameTenant=(a:Tenant,b:Tenant)=>a.tenantId===b.tenantId&&a.tenantKey===b.tenantKey&&a.displayName===b.displayName&&a.status===b.status&&a.createdAt===b.createdAt;
const sameWorkspaceIdentity=(a:Workspace,b:Workspace)=>a.workspaceId===b.workspaceId&&a.tenantId===b.tenantId&&a.workspaceKey===b.workspaceKey&&a.status===b.status&&a.createdAt===b.createdAt;

/** Storage validates the complete proposed scope before applying any effect.
 * Name lookup uses the PDO parameter; varchar storage is a later phase and
 * may legitimately produce two equal names with different native identities. */
export function validateOriginalWorkspaceDirectoryEffect(s:OriginalAdminSessionSnapshot,e:OriginalAdminSessionEffect,selector:OriginalAdminSelector):void {
 const c=e.workspaceChange;if(!c)return;
 if(!('token' in selector)||selector.directory!=='workspaces'||selector.workspaceWrite!==c.kind||
  !originalAdminMetadataAllowed(s,selector)||!s.roles.some(r=>r.role==='platform_admin'))throw Error('Native workspace writer authorization changed.');
 if(Object.keys(e).some(key=>!['workspaceChange','workspaceNumbers','workspaceCounter','directoryJson','audit'].includes(key)))throw Error('Native workspace writer effect scope changed.');
 const d=s.directory,w=c.workspace,t=c.tenant,a=e.audit;
 if(!d?.workspaces||!d.tenants||w.tenantId!==t.tenantId||w.status!=='active'||t.status!=='active'||
  !w.workspaceId||!w.workspaceKey||!t.tenantId||!t.tenantKey||!Number.isFinite(Date.parse(w.createdAt)))throw Error('Native workspace parent scope changed.');
 if(typeof w.displayName!=='string'||originalWorkspaceNameParameter(w.displayName).parameter!==w.displayName||originalWorkspaceStoredName(w.displayName)!==w.displayName)throw Error('Native workspace stored name changed.');
 if(!a||a.actorAdminUserId!==s.user?.adminUserId||a.subjectAdminUserId!==null||a.eventType!==(c.kind==='create'?'workspace_created':'workspace_renamed')||
  !Number.isFinite(Date.parse(a.occurredAt))||a.details.native!==true||a.details.workspaceId!==w.workspaceId||a.details.tenantId!==t.tenantId)throw Error('Native workspace audit scope changed.');
 if(c.kind==='create'){
  if(t.tenantKey!==originalAdministrationWorkspaceTenantKey||d.creationTenant===undefined)throw Error('Native workspace creation tenant is unavailable.');
  if(d.creationTenant){if(c.createTenant||!sameTenant(t,d.creationTenant))throw Error('Native workspace creation tenant changed.');}
  else if(!c.createTenant||!Number.isFinite(Date.parse(t.createdAt)))throw Error('Native workspace creation tenant changed.');
  if(d.workspaces.some(row=>row.workspace.workspaceId===w.workspaceId))throw Error('Native workspace creation identity collision.');
  const n=e.workspaceNumbers?.[0],expected=(originalAdminNumber(s.workspaceCounter,true)+1n).toString();
  if(e.workspaceNumbers?.length!==1||!n||n.workspaceId!==w.workspaceId||n.tenantId!==t.tenantId||n.workspaceNumber!==expected||
   e.workspaceCounter!==expected||e.directoryJson!==expected||a.details.workspaceNumber!==expected)throw Error('Native workspace numeric identity changed.');
  originalAdminNumber(expected);
 }else{
  const old=d.workspaces.find(row=>row.workspace.workspaceId===w.workspaceId),parent=d.tenants.find(row=>row.tenantId===t.tenantId);
  if(!old||!parent||!sameTenant(t,parent)||!sameWorkspaceIdentity(w,old.workspace)||c.createTenant||e.workspaceNumbers||e.workspaceCounter!==undefined||e.directoryJson!=='')throw Error('Native workspace rename scope changed.');
  if(old.workspaceNumber===null||a.details.workspaceNumber!==old.workspaceNumber)throw Error('Native workspace rename identity changed.');
  originalAdminNumber(old.workspaceNumber);
 }
}

export type OriginalWorkspaceDirectoryPort={
 createWorkspace(input:{token:string;body:unknown}):Promise<string>;
 renameWorkspace(input:{token:string;reference:string;body:unknown}):Promise<void>;
};
export function createOriginalWorkspaceDirectoryPort(input:{repository:OriginalAdminSessionRepository;now:()=>string;id:()=>string}):OriginalWorkspaceDirectoryPort {
 const run=async(token:string,kind:'create'|'rename',action:(s:OriginalAdminSessionSnapshot)=>OriginalAdminSessionEffect)=>{
  const effect=await input.repository.mutateOriginalAdminSession({token,at:input.now(),directory:'workspaces',workspaceWrite:kind},s=>{
   if(!originalAdminMetadataAllowed(s,{token,at:input.now()}))throw new FirstSliceError(403,'original_admin_session_invalid','Invalid token.');
   if(!s.roles.some(r=>r.role==='platform_admin'))throw new FirstSliceError(403,'original_super_admin_required','Only SuperAdmins can do that!');
   return action(s);
  });
  if(effect.error)throw effect.error;
  if(effect.directoryJson===undefined)throw Error('Missing native workspace write result.');
  return effect.directoryJson;
 };
 const name=(s:OriginalAdminSessionSnapshot,field:unknown)=>{
  if(!s.directory?.workspaces)throw unavailable();
  const value=originalWorkspaceNameParameter(field);
  if(s.directory.workspaces.some(row=>originalParticipantGroupKeysEqual(row.workspace.displayName,value.parameter)))throw new FirstSliceError(409,'original_workspace_name_conflict','Workspace with name `'+value.source+'` already exists!');
  return originalWorkspaceStoredName(value.parameter);
 };
 const audit=(s:OriginalAdminSessionSnapshot,w:Workspace,number:string,kind:'create'|'rename')=>({adminAuditEventId:input.id(),eventType:kind==='create'?'workspace_created' as const:'workspace_renamed' as const,
  actorAdminUserId:s.user!.adminUserId,subjectAdminUserId:null,occurredAt:input.now(),summary:kind==='create'?'Native workspace created':'Native workspace renamed',details:{native:true,tenantId:w.tenantId,workspaceId:w.workspaceId,workspaceNumber:number}});
 return{
  createWorkspace:request=>run(request.token,'create',s=>{
   const field=readOriginalWorkspaceName(request.body,'create'),displayName=name(s,field);
   if(!s.directory?.tenants||s.directory.creationTenant===undefined)throw unavailable();
   const timestamp=input.now(),existing=s.directory.creationTenant;
   if(existing&&existing.status!=='active')throw unavailable();
   const tenant:Tenant=existing??{tenantId:input.id(),tenantKey:originalAdministrationWorkspaceTenantKey,displayName:'Original interface',status:'active',createdAt:timestamp};
   const workspace:Workspace={workspaceId:input.id(),tenantId:tenant.tenantId,workspaceKey:'workspace-'+input.id(),displayName,status:'active',createdAt:timestamp};
   const number=prepareOriginalWorkspaceNumber(workspace,workspace,undefined,s.workspaceCounter);
   return{workspaceChange:{kind:'create',tenant,workspace,...existing?{}:{createTenant:true}},workspaceNumbers:[number.record],workspaceCounter:number.counter,
    directoryJson:number.record.workspaceNumber,audit:audit(s,workspace,number.record.workspaceNumber,'create')};
  }),
  renameWorkspace:async request=>{await run(request.token,'rename',s=>{
   const field=readOriginalWorkspaceName(request.body,'rename'),reference=originalCommandInteger(request.reference).toString();
   if(!s.directory?.workspaces||!s.directory.tenants)throw unavailable();
   const matches=s.directory.workspaces.filter(row=>row.workspaceNumber===reference);
   if(matches.length>1)throw unavailable();
   const old=matches[0];
   if(!old)throw new FirstSliceError(400,'original_workspace_missing','Workspace with id `'+reference+'` does not exist!');
   originalAdminNumber(reference);
   const tenant=s.directory.tenants.find(t=>t.tenantId===old.workspace.tenantId);if(!tenant)throw unavailable();
   const workspace={...old.workspace,displayName:name(s,field)};
   return{workspaceChange:{kind:'rename',tenant,workspace},directoryJson:'',audit:audit(s,workspace,reference,'rename')};
  });}
 };
}
