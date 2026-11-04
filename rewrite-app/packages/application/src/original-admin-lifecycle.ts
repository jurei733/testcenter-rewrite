import type {AdminRoleAssignment} from '@testcenter-rewrite-app/domain';
import {FirstSliceError} from './first-slice-error.js';
import {OriginalPhpObject} from './original-test-log-json.js';
import {originalCommandInteger} from './original-command-codec.js';
import {originalAdminMetadataAllowed,originalAdminNumber,type OriginalAdminSelector,type OriginalAdminSessionSnapshot,type OriginalAdminSessionEffect,type OriginalAdminSessionRepository} from './original-admin-session.js';

const field=(body:unknown,key:string):unknown=>body instanceof OriginalPhpObject?body.fields.get(key):
 body&&typeof body==='object'&&!Array.isArray(body)&&Object.hasOwn(body,key)?(body as Record<string,unknown>)[key]:undefined;
const unavailable=()=>new FirstSliceError(409,'original_admin_directory_unavailable','The native administrator directory is unavailable.');
const aliases=new Set(['on','true','1','TRUE','True','ON','On','off','false','0','FALSE','False','OFF','Off']);

export type OriginalAdminLifecyclePort={setSuperadmin(input:{token:string;reference:string;status:string;body:unknown}):Promise<void>};

/** Validate against the original storage snapshot, never callback-edited
 * metadata. Only the target's global Root rows may change; no workspace,
 * Tenant, group, monitor, credential or session payload is part of this effect. */
export function validateOriginalAdminLifecycleEffect(s:OriginalAdminSessionSnapshot,e:OriginalAdminSessionEffect,selector:OriginalAdminSelector):void {
 const c=e.rootRoleChange;if(!c)return;
 if(!('token' in selector)||selector.directory!=='users'||selector.adminWrite!=='superadmin'||
  !originalAdminMetadataAllowed(s,selector)||!s.roles.some(role=>role.role==='platform_admin'))throw Error('Native Root writer authorization changed.');
 if(Object.keys(e).some(key=>!['rootRoleChange','directoryJson','audit'].includes(key)))throw Error('Native Root writer effect scope changed.');
 const target=s.directory?.users?.find(user=>user.adminUserId===c.adminUserId),a=e.audit;
 if(!target||!target.rootRoleAssignmentIds||target.adminNumber===null)throw Error('Native Root target metadata is unavailable.');
 originalAdminNumber(target.adminNumber);
 if(!c.enabled&&target.adminUserId===s.user?.adminUserId)throw Error('Native Root self-revocation is forbidden.');
 const ids=target.rootRoleAssignmentIds;
 if(new Set(ids).size!==ids.length||new Set(c.removeIds).size!==c.removeIds.length||e.directoryJson!=='')throw Error('Native Root identity changed.');
 if(c.enabled){
  const r=c.assignment;
  if(ids.length||target.isSuperadmin||c.removeIds.length||!r||r.adminUserId!==target.adminUserId||r.role!=='platform_admin'||r.accessMode!=='read_write'||
   r.tenantId!==null||r.workspaceId!==null||r.groupKey!==null||r.monitorProfiles.length||r.monitorBookletVisibility!=='visible'||!r.roleAssignmentId||!Number.isFinite(Date.parse(r.createdAt)))throw Error('Native Root assignment scope changed.');
 }else if(!target.isSuperadmin||!ids.length||c.assignment||c.removeIds.length!==ids.length||c.removeIds.some(id=>!ids.includes(id)))throw Error('Native Root removal scope changed.');
 if(!a||a.actorAdminUserId!==s.user?.adminUserId||a.subjectAdminUserId!==target.adminUserId||a.eventType!==(c.enabled?'admin_role_assigned':'admin_role_revoked')||
  a.details.native!==true||a.details.role!=='platform_admin'||a.details.adminNumber!==target.adminNumber||!Number.isFinite(Date.parse(a.occurredAt)))throw Error('Native Root audit scope changed.');
}

export function createOriginalAdminLifecyclePort(input:{repository:OriginalAdminSessionRepository;now:()=>string;id:()=>string;verifyPassword:(password:string,hash:string)=>boolean}):OriginalAdminLifecyclePort {
 return{setSuperadmin:async request=>{
  const effect=await input.repository.mutateOriginalAdminSession({token:request.token,at:input.now(),directory:'users',adminWrite:'superadmin'},s=>{
   if(!originalAdminMetadataAllowed(s,{token:request.token,at:input.now()}))throw new FirstSliceError(403,'original_admin_session_invalid','Invalid token.');
   if(!s.roles.some(role=>role.role==='platform_admin'))throw new FirstSliceError(403,'original_super_admin_required','Only SuperAdmins can do that!');
   if(!aliases.has(request.status))throw new FirstSliceError(400,'original_superadmin_status_invalid','New Status `'+request.status+'` is undefined!');
   const password=field(request.body,'p');
   if(password===undefined||password===null)throw new FirstSliceError(400,'original_confirmation_password_missing','Provide Password for security reasons!');
   if(typeof password!=='string')throw new FirstSliceError(500,'original_confirmation_password_invalid','Internal error.');
   if(!s.number)throw unavailable();originalAdminNumber(s.number.adminNumber);
   if(!input.verifyPassword(password,s.user!.passwordHash))throw new FirstSliceError(403,'original_confirmation_password_incorrect','Invalid password for user '+s.number.adminNumber);
   if(!s.directory?.users)throw unavailable();
   const reference=originalCommandInteger(request.reference).toString(),targets=s.directory.users.filter(user=>user.adminNumber===reference);
   if(targets.length>1)throw unavailable();
   const target=targets[0];if(!target)return{directoryJson:''};
   // Original accepts several aliases, but its actual final comparison enables
   // Root only for the literal "on". Keep that measured distinction.
   const enabled=request.status==='on';
   if(!enabled&&target.adminUserId===s.user!.adminUserId)throw new FirstSliceError(409,'admin_self_revoke_platform_role_forbidden','The active admin user cannot revoke their own platform admin role.');
   if(!target.rootRoleAssignmentIds)throw unavailable();
   if(target.isSuperadmin===enabled)return{directoryJson:''};
   const timestamp=input.now();
   const assignment:AdminRoleAssignment|undefined=enabled?{roleAssignmentId:input.id(),adminUserId:target.adminUserId,role:'platform_admin',accessMode:'read_write',
    tenantId:null,workspaceId:null,groupKey:null,monitorProfiles:[],monitorBookletVisibility:'visible',createdAt:timestamp}:undefined;
   return{rootRoleChange:{adminUserId:target.adminUserId,enabled,removeIds:enabled?[]:[...target.rootRoleAssignmentIds],...assignment?{assignment}:{}},directoryJson:'',
    audit:{adminAuditEventId:input.id(),eventType:enabled?'admin_role_assigned':'admin_role_revoked',actorAdminUserId:s.user!.adminUserId,subjectAdminUserId:target.adminUserId,
     occurredAt:timestamp,summary:enabled?'Native Root role assigned':'Native Root role revoked',details:{native:true,role:'platform_admin',adminNumber:target.adminNumber,
      ...assignment?{roleAssignmentId:assignment.roleAssignmentId}:{roleAssignmentIds:[...target.rootRoleAssignmentIds]}}}};
  });
  if(effect.error)throw effect.error;if(effect.directoryJson!=='')throw Error('Missing native Root status result.');
 }};
}
