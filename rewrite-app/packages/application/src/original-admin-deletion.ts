import {FirstSliceError} from './first-slice-error.js';
import {OriginalPhpObject} from './original-test-log-json.js';
import {originalAdministrationDeletionId} from './original-administration-deletion-id.js';
import {originalAdminMetadataAllowed,originalAdminNumber,type OriginalAdminSelector,type OriginalAdminSessionSnapshot,type OriginalAdminSessionEffect,type OriginalAdminSessionRepository} from './original-admin-session.js';

const field=(body:unknown,key:string):unknown=>body instanceof OriginalPhpObject?body.fields.get(key):
 body&&typeof body==='object'&&!Array.isArray(body)&&Object.hasOwn(body,key)?(body as Record<string,unknown>)[key]:undefined;
const unavailable=()=>new FirstSliceError(409,'original_admin_directory_unavailable','The native administrator directory is unavailable.');
export type OriginalAdminDeletionPort={deleteUsers(input:{token:string;body:unknown}):Promise<void>};

/** Delete exactly these current native identities and owned role/session
 * rows. No target is recovered from a name or callback-edited metadata. */
export function validateOriginalAdminDeletionEffect(s:OriginalAdminSessionSnapshot,e:OriginalAdminSessionEffect,selector:OriginalAdminSelector):void {
 const users=e.deletedUsers;if(!users)return;
 if(!('token' in selector)||selector.directory!=='users'||selector.adminWrite!=='delete-users'||
  !originalAdminMetadataAllowed(s,selector)||!s.roles.some(role=>role.role==='platform_admin'))throw Error('Native user deletion authorization changed.');
 if(Object.keys(e).some(key=>!['deletedUsers','directoryJson','audits'].includes(key))||e.directoryJson!==''||!users.length||
  new Set(users.map(user=>user.adminUserId)).size!==users.length||new Set(users.map(user=>user.adminNumber)).size!==users.length||e.audits?.length!==users.length)throw Error('Native user deletion effect changed.');
 users.forEach((user,index)=>{
  const old=s.directory?.users?.find(row=>row.adminUserId===user.adminUserId),audit=e.audits![index]!;
  if(!old||old.adminNumber!==user.adminNumber||old.username!==user.username||user.adminUserId===s.user?.adminUserId)throw Error('Native user deletion target changed.');
  originalAdminNumber(user.adminNumber);
  if(audit.eventType!=='admin_user_deleted'||audit.actorAdminUserId!==s.user?.adminUserId||audit.subjectAdminUserId!==user.adminUserId||
   audit.details.native!==true||audit.details.adminNumber!==user.adminNumber||audit.details.username!==user.username||!Number.isFinite(Date.parse(audit.occurredAt)))throw Error('Native user deletion audit changed.');
 });
}
export function createOriginalAdminDeletionPort(input:{repository:OriginalAdminSessionRepository;now:()=>string;id:()=>string;verifyPassword:(password:string,hash:string)=>boolean}):OriginalAdminDeletionPort {
 return{deleteUsers:async request=>{
  const effect=await input.repository.mutateOriginalAdminSession({token:request.token,at:input.now(),directory:'users',adminWrite:'delete-users'},s=>{
   if(!originalAdminMetadataAllowed(s,{token:request.token,at:input.now()}))throw new FirstSliceError(403,'original_admin_session_invalid','Invalid token.');
   if(!s.roles.some(role=>role.role==='platform_admin'))throw new FirstSliceError(403,'original_super_admin_required','Only SuperAdmins can do that!');
   const password=field(request.body,'p');
   if(password===undefined||password===null)throw new FirstSliceError(400,'original_confirmation_password_missing','Provide Password for security reasons!');
   if(typeof password!=='string')throw new FirstSliceError(500,'original_confirmation_password_invalid','Internal error.');
   if(!s.number)throw unavailable();originalAdminNumber(s.number.adminNumber);
   if(!input.verifyPassword(password,s.user!.passwordHash))throw new FirstSliceError(403,'original_confirmation_password_incorrect','Invalid password for user '+s.number.adminNumber);
   // User DELETE checks password before collection type. Workspace DELETE
   // has a different measured order and must keep its own validation path.
   const values=field(request.body,'u')??[];
   if(!Array.isArray(values))throw new FirstSliceError(500,'original_user_deletion_list_invalid','Internal error.');
   if(!s.directory?.users)throw unavailable();
   const references=new Set(values.map(originalAdministrationDeletionId));
   const users:NonNullable<OriginalAdminSessionEffect['deletedUsers']>=[];
   for(const reference of references){
    if(reference===null)continue;
    const matches=s.directory.users.filter(user=>user.adminNumber===reference);if(matches.length>1)throw unavailable();
    const target=matches[0];if(!target)continue;
    if(target.adminUserId===s.user!.adminUserId)throw new FirstSliceError(409,'admin_self_delete_forbidden','The active admin user cannot delete their own account.');
    if(target.adminNumber===null)throw unavailable();originalAdminNumber(target.adminNumber);
    users.push({adminUserId:target.adminUserId,adminNumber:target.adminNumber,username:target.username});
   }
   if(!users.length)return{directoryJson:''};
   const timestamp=input.now();
   return{deletedUsers:users,directoryJson:'',audits:users.map(user=>({adminAuditEventId:input.id(),eventType:'admin_user_deleted' as const,
    actorAdminUserId:s.user!.adminUserId,subjectAdminUserId:user.adminUserId,occurredAt:timestamp,summary:'Native administrator deleted',details:{native:true,adminNumber:user.adminNumber,username:user.username}}))};
  });
  if(effect.error)throw effect.error;if(effect.directoryJson!=='')throw Error('Missing native user deletion result.');
 }};
}
