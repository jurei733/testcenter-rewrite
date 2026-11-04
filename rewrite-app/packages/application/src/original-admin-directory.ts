import type {AdminUser,SourcePackage,WorkspaceActivityEvent} from '@testcenter-rewrite-app/domain';
import {FirstSliceError} from './first-slice-error.js';
import {originalParticipantGroupKeysEqual,compareOriginalParticipantGroupKeys} from './original-participant-group.js';
import {selectCurrentWorkspaceFiles} from './workspace-file-catalog.js';
import {prepareOriginalWorkspaceNumber} from './original-workspace-number.js';
import {encodeOriginalReportJson} from './original-workspace-report-wire.js';
import {prepareOriginalAdminNumber,originalAdminNumber,originalAdminMetadataAllowed,type OriginalAdminSessionSnapshot,type OriginalAdminSessionRepository} from './original-admin-session.js';
import {createOriginalWorkspaceDirectoryPort,type OriginalWorkspaceDirectoryPort} from './original-workspace-directory.js';

export type OriginalDirectoryFile = Pick<SourcePackage,'sourcePackageId'|'status'|'uploadedAt'|'tenantId'|'workspaceId'>;
export type OriginalDirectoryFileEvent = Pick<WorkspaceActivityEvent,'eventType'|'subjectId'|'details'|'tenantId'|'workspaceId'>;
/** Reuse the physical catalog's replacement/assembly rules without opening any
 * XML, archive, response, release or unrelated activity-event payload. */
export function originalDirectoryModification(files:OriginalDirectoryFile[],events:OriginalDirectoryFileEvent[],tenantId:string,workspaceId:string):string|null {
  const scoped=files.filter(f=>f.tenantId===tenantId&&f.workspaceId===workspaceId);
  const physical=selectCurrentWorkspaceFiles(scoped,events.filter(e=>e.tenantId===tenantId&&e.workspaceId===workspaceId));
  if(physical.some(f=>!Number.isFinite(Date.parse(f.uploadedAt))))throw new FirstSliceError(409,'original_file_history_unknown','The native file modification history is unavailable.');
  return physical.map(f=>f.uploadedAt).sort((a,b)=>Date.parse(b)-Date.parse(a))[0]??null;
}
const idRow=(row:Record<string,unknown>&{id:string}):string=>{
  originalAdminNumber(row.id);
  return '{'+Object.entries(row).map(([key,value])=>encodeOriginalReportJson(key)+':'+(key==='id'?row.id:encodeOriginalReportJson(value))).join(',')+'}';
};
const array=(rows:Array<Record<string,unknown>&{id:string}>)=>'['+rows.map(idRow).join(',')+']';
function displayDate(value:string|null,timeZone:string):string|null {
  if(value===null||Date.parse(value)<=0)return null;
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));
  const p=(type:string)=>parts.find(p=>p.type===type)!.value;
  return `${p('year')}-${p('month')}-${p('day')} ${p('hour')}:${p('minute')}:${p('second')}`;
}
export type OriginalAdminDirectoryPort=OriginalWorkspaceDirectoryPort&{
  listUsers(input:{token:string}):Promise<string>;
  listWorkspaces(input:{token:string}):Promise<string>;
  createUser(input:{token:string;name:string;password:string}):Promise<string>;
};
export function createOriginalAdminDirectoryPort(input:{repository:OriginalAdminSessionRepository;now:()=>string;id:()=>string;timeZone:string;
  validatePassword:(password:string)=>string;hashPassword:(password:string)=>string}):OriginalAdminDirectoryPort {
  const authorize=(s:OriginalAdminSessionSnapshot,token:string)=>{
    if(!originalAdminMetadataAllowed(s,{token,at:input.now()}))throw new FirstSliceError(403,'original_admin_session_invalid','Invalid token.');
    if(!s.roles.some(r=>r.adminUserId===s.user!.adminUserId&&r.role==='platform_admin'))throw new FirstSliceError(403,'original_super_admin_required','Only SuperAdmins can do that!');
  };
  const run=async(token:string,directory:'users'|'workspaces',action:(s:OriginalAdminSessionSnapshot)=>import('./original-admin-session.js').OriginalAdminSessionEffect)=>{
    const effect=await input.repository.mutateOriginalAdminSession({token,at:input.now(),directory},s=>{authorize(s,token);return action(s);});
    if(effect.error)throw effect.error;
    if(effect.directoryJson===undefined)throw Error('Missing native directory result.');
    return effect.directoryJson;
  };
  return {
    ...createOriginalWorkspaceDirectoryPort(input),
    listUsers:({token})=>run(token,'users',s=>{
      if(!s.directory?.users)throw new FirstSliceError(409,'original_admin_directory_unavailable','The native administrator directory is unavailable.');
      let counter=s.counter;const numbers:import('./original-admin-session.js').OriginalAdminNumber[]=[];
      const ids=new Set<string>();
      const rows=s.directory.users.slice().sort((a,b)=>compareOriginalParticipantGroupKeys(a.username,b.username)).map(user=>{
        const previous=user.adminNumber===null?null:{adminUserId:user.adminUserId,adminNumber:user.adminNumber};
        const identity=prepareOriginalAdminNumber(user,previous,counter);counter=identity.counter;
        if(!previous)numbers.push(identity.number);
        if(ids.has(identity.number.adminNumber))throw new FirstSliceError(409,'original_admin_identity_ambiguous','The native administrator identity is ambiguous.');
        ids.add(identity.number.adminNumber);
        return {name:user.username,id:identity.number.adminNumber,email:null,isSuperadmin:user.isSuperadmin};
      });
      return {adminNumbers:numbers,counter,directoryJson:array(rows)};
    }),
    listWorkspaces:({token})=>run(token,'workspaces',s=>{
      if(!s.directory?.workspaces)throw new FirstSliceError(409,'original_workspace_directory_unavailable','The native workspace directory is unavailable.');
      let counter=s.workspaceCounter;const numbers:import('./original-workspace-number.js').OriginalWorkspaceNumberRecord[]=[];
      const ids=new Set<string>();
      const rows=s.directory.workspaces.slice().sort((a,b)=>compareOriginalParticipantGroupKeys(a.workspace.displayName,b.workspace.displayName)).map(row=>{
        const previous=row.workspaceNumber===null?undefined:{tenantId:row.workspace.tenantId,workspaceId:row.workspace.workspaceId,workspaceNumber:row.workspaceNumber};
        const identity=prepareOriginalWorkspaceNumber(row.workspace,row.workspace,previous,counter);counter=identity.counter;
        if(!previous)numbers.push(identity.record);
        if(ids.has(identity.record.workspaceNumber))throw new FirstSliceError(409,'original_workspace_history_unknown','The native workspace identity is ambiguous.');
        ids.add(identity.record.workspaceNumber);
        return{id:identity.record.workspaceNumber,name:row.workspace.displayName,latest_modification_ts:displayDate(row.latestModificationAt,input.timeZone)};
      });
      return{workspaceNumbers:numbers,workspaceCounter:counter,directoryJson:array(rows)};
    }),
    createUser:request=>run(request.token,'users',s=>{
      if(typeof request.name!=='string'||typeof request.password!=='string')throw new FirstSliceError(500,'original_user_malformed','Internal error.');
      const password=input.validatePassword(request.password);
      if(Buffer.byteLength(password)>60)throw new FirstSliceError(400,'original_password_too_long','Password too long');
      if([...request.name].length>50||request.name.includes('\0'))throw new FirstSliceError(500,'original_user_malformed','Internal error.');
      if(!s.directory?.users)throw new FirstSliceError(409,'original_admin_directory_unavailable','The native administrator directory is unavailable.');
      if(s.directory.users.some(user=>originalParticipantGroupKeysEqual(user.username,request.name)))throw new FirstSliceError(409,'original_admin_name_conflict','User with name `'+request.name+'` already exists!');
      const timestamp=input.now();
      const user:AdminUser={adminUserId:input.id(),username:request.name,displayName:request.name,passwordHash:input.hashPassword(password),passwordChangeRequired:true,
        status:'active',customTexts:{},validFrom:null,validTo:null,validForMinutes:null,firstSignedInAt:null,createdAt:timestamp};
      const identity=prepareOriginalAdminNumber(user,null,s.counter);
      return{createdUser:user,adminNumbers:[identity.number],counter:identity.counter,directoryJson:identity.number.adminNumber,
        audit:{adminAuditEventId:input.id(),eventType:'admin_user_created',actorAdminUserId:s.user!.adminUserId,subjectAdminUserId:user.adminUserId,occurredAt:timestamp,summary:'Native administrator created',details:{native:true,adminNumber:identity.number.adminNumber}}};
    })
  };
}
