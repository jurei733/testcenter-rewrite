import type {AdminRoleAssignment, AdminAuditEvent} from '@testcenter-rewrite-app/domain';
import {FirstSliceError} from './first-slice-error.js';
import {originalCommandInteger, originalCommandFloatString} from './original-command-codec.js';
import {OriginalPhpNumber, OriginalPhpObject} from './original-test-log-json.js';
import {prepareOriginalWorkspaceNumber} from './original-workspace-number.js';
import {compareOriginalParticipantGroupKeys} from './original-participant-group.js';
import {encodeOriginalReportJson} from './original-workspace-report-wire.js';
import {isOriginalWorkspaceMembership,originalWorkspaceRoleValue} from './original-workspace-role.js';
import {originalAdminMetadataAllowed, prepareOriginalAdminNumber,
  type OriginalAdminSelector, type OriginalAdminSessionRepository, type OriginalAdminSessionSnapshot, type OriginalAdminSessionEffect} from './original-admin-session.js';

export type OriginalAdminPermissionsPort = {
  usersByWorkspace(input:{token:string;reference:string}):Promise<string>;
  workspacesByUser(input:{token:string;reference:string}):Promise<string>;
  replaceWorkspaceUsers(input:{token:string;reference:string;body:unknown}):Promise<void>;
  replaceUserWorkspaces(input:{token:string;reference:string;body:unknown}):Promise<void>;
};
const internal = () => new FirstSliceError(500,'original_permission_fields_invalid','Internal error.');
const field = (value:unknown,key:string):unknown => value instanceof OriginalPhpObject ? value.fields.get(key)
  : value && typeof value==='object' && !Array.isArray(value) && Object.hasOwn(value,key) ? (value as Record<string,unknown>)[key] : undefined;
function pdoText(value:unknown):string {
  if(value instanceof OriginalPhpNumber)return value.integer?.toString() ?? originalCommandFloatString(value.value);
  if(value==null||value===false)return '';
  if(value===true)return '1';
  if(typeof value==='string')return value.split('\0',1)[0]!;
  if(typeof value==='number'){
    if(!Number.isSafeInteger(value))throw internal();
    return String(value);
  }
  throw internal();
}
function bodyNumber(value:unknown):string {
  const text=pdoText(value);
  // PDO's bigint parameter differs from PHP's permissive path cast. Never
  // turn a fractional/scientific string into another person's identifier.
  if(!/^[\x20\t\r\n\f\v]*[+-]?[0-9]+[\x20\t\r\n\f\v]*$/.test(text))throw internal();
  const id=BigInt(text.trim());
  if(id < -9223372036854775808n || id > 9223372036854775807n)throw internal();
  return id.toString();
}
function entries(body:unknown,key:'u'|'ws'):Array<{number:string;role:string}> {
  const value=field(body,key);
  if(value==null||Array.isArray(value)&&!value.length)throw new FirstSliceError(400,'original_permission_list_missing',
    key==='u'?'User-list (u) is missing':'Workspace-list (ws) is missing.');
  if(!Array.isArray(value))throw internal();
  const result:Array<{number:string;role:string}>=[],seen=new Set<string>();
  for(const row of value){
    const raw=field(row,'role');
    if(typeof raw!=='string')throw internal();
    if(raw==='')continue; // Source skips the ID entirely for an empty role.
    // PDO truncates at the first NUL. PostgreSQL varchar(10) counts Unicode
    // characters and discards excess U+0020 spaces, but rejects other excess.
    const characters=[...pdoText(raw)];
    if(characters.slice(10).some(character=>character!==' '))throw internal();
    const role=characters.slice(0,10).join('');
    if(Buffer.from(role,'utf8').toString('utf8')!==role)throw internal();
    const number=bodyNumber(field(row,'id'));
    if(seen.has(number))throw internal();
    seen.add(number);result.push({number,role});
  }
  return result;
}
const pair=(r:Pick<AdminRoleAssignment,'adminUserId'|'tenantId'|'workspaceId'>)=>JSON.stringify([r.adminUserId,r.tenantId,r.workspaceId]);
const inScope=(r:AdminRoleAssignment,scope:NonNullable<OriginalAdminSessionEffect['roleChanges']>['scope'])=>
  isOriginalWorkspaceMembership(r)&&r.groupKey===null&&(scope.kind==='user'?r.adminUserId===scope.adminUserId:r.tenantId===scope.tenantId&&r.workspaceId===scope.workspaceId);

/** Storage ports apply only the explicit native workspace grants shown in the
 * current directory. Root/Tenant/monitor roles and hidden scopes are untouched. */
export function validateOriginalAdminRoleChanges(snapshot:OriginalAdminSessionSnapshot,effect:OriginalAdminSessionEffect,selector:OriginalAdminSelector):void {
  if(!effect.roleChanges)return;
  if(!('token' in selector)||selector.directory!=='rights'||!selector.rightsWrite||
    !originalAdminMetadataAllowed(snapshot,selector)||!snapshot.roles.some(r=>r.role==='platform_admin'))throw Error('Native permission writer authorization changed.');
  const change=effect.roleChanges,d=snapshot.directory;
  if(!d?.users||!d.workspaces||!d.roles)throw Error('Native permission metadata is unavailable.');
  const old=d.roles.filter(r=>inScope(r,change.scope)),oldIds=new Set(old.map(r=>r.roleAssignmentId));
  if(new Set(change.removeIds).size!==change.removeIds.length||change.removeIds.some(id=>!oldIds.has(id)))throw Error('Native permission removal scope changed.');
  const ids=new Set<string>(),pairs=new Set<string>();
  for(const r of change.assignments){
    originalWorkspaceRoleValue(r);
    if(!inScope(r,change.scope)||!['read_only','read_write'].includes(r.accessMode)||
      !d.users.some(u=>u.adminUserId===r.adminUserId)||!d.workspaces.some(w=>w.workspace.workspaceId===r.workspaceId&&w.workspace.tenantId===r.tenantId))throw Error('Native permission assignment scope changed.');
    if(ids.has(r.roleAssignmentId)||pairs.has(pair(r)))throw Error('Native permission assignment collision.');
    const previous=d.roles.find(p=>p.roleAssignmentId===r.roleAssignmentId);
    if(previous&&pair(previous)!==pair(r))throw Error('Native permission identity changed.');
    ids.add(r.roleAssignmentId);pairs.add(pair(r));
  }
}
export function createOriginalAdminPermissionsPort(input:{repository:OriginalAdminSessionRepository;now:()=>string;id:()=>string}):OriginalAdminPermissionsPort {
  const run=async(token:string,write:boolean,action:(s:OriginalAdminSessionSnapshot)=>OriginalAdminSessionEffect)=>{
    const effect=await input.repository.mutateOriginalAdminSession({token,at:input.now(),directory:'rights',rightsWrite:write},s=>{
      if(!originalAdminMetadataAllowed(s,{token,at:input.now()}))throw new FirstSliceError(403,'original_admin_session_invalid','Invalid token.');
      if(!s.roles.some(r=>r.role==='platform_admin'))throw new FirstSliceError(403,'original_super_admin_required','Only SuperAdmins can do that!');
      return action(s);
    });
    if(effect.error)throw effect.error;
    return effect.directoryJson??'';
  };
  function directory(s:OriginalAdminSessionSnapshot){
    if(!s.directory?.users||!s.directory.workspaces||!s.directory.roles)throw new FirstSliceError(409,'original_permission_metadata_unavailable','Native permission metadata is unavailable.');
    let counter=s.counter,workspaceCounter=s.workspaceCounter;
    const adminNumbers:NonNullable<OriginalAdminSessionEffect['adminNumbers']>=[],workspaceNumbers:NonNullable<OriginalAdminSessionEffect['workspaceNumbers']>=[];
    const users=s.directory.users.slice().sort((a,b)=>compareOriginalParticipantGroupKeys(a.username,b.username)).map(u=>{
      const previous=u.adminNumber===null?null:{adminUserId:u.adminUserId,adminNumber:u.adminNumber};
      const identity=prepareOriginalAdminNumber(u,previous,counter);counter=identity.counter;
      if(!previous)adminNumbers.push(identity.number);
      return {...u,number:identity.number.adminNumber};
    });
    const workspaces=s.directory.workspaces.slice().sort((a,b)=>compareOriginalParticipantGroupKeys(a.workspace.displayName,b.workspace.displayName)).map(w=>{
      const previous=w.workspaceNumber===null?undefined:{workspaceId:w.workspace.workspaceId,tenantId:w.workspace.tenantId,workspaceNumber:w.workspaceNumber};
      const identity=prepareOriginalWorkspaceNumber(w.workspace,w.workspace,previous,workspaceCounter);workspaceCounter=identity.counter;
      if(!previous)workspaceNumbers.push(identity.record);
      return {...w.workspace,number:identity.record.workspaceNumber};
    });
    if(new Set(users.map(u=>u.number)).size!==users.length||new Set(workspaces.map(w=>w.number)).size!==workspaces.length)throw new FirstSliceError(409,'original_permission_identity_ambiguous','Native permission identity is ambiguous.');
    const roles=new Map<string,AdminRoleAssignment>();
    for(const r of s.directory.roles){if(roles.has(pair(r)))throw new FirstSliceError(409,'original_permission_history_ambiguous','Native permission history is ambiguous.');roles.set(pair(r),r);}
    return {users,workspaces,roles,effect:{adminNumbers,workspaceNumbers,counter,workspaceCounter}};
  }
  function rows(values:Array<{id:string;name:string;role:AdminRoleAssignment|undefined}>):string {
    return '['+values.map(r=>'{"id":'+r.id+',"name":'+encodeOriginalReportJson(r.name)+',"selected":'+Boolean(r.role)+',"role":'+encodeOriginalReportJson(r.role?originalWorkspaceRoleValue(r.role):'')+'}').join(',')+']';
  }
  const replace=(token:string,reference:string,body:unknown,kind:'user'|'workspace')=>run(token,true,s=>{
    const desired=entries(body,kind==='user'?'ws':'u'),d=directory(s),number=originalCommandInteger(reference).toString();
    const user=d.users.find(u=>u.number===number),workspace=d.workspaces.find(w=>w.number===number);
    const target=kind==='user'?user:workspace;
    if(!target){if(desired.length)throw internal();return {...d.effect,directoryJson:''};}
    const scope:NonNullable<OriginalAdminSessionEffect['roleChanges']>['scope']=kind==='user'?{kind:'user',adminUserId:user!.adminUserId}:{kind:'workspace',tenantId:workspace!.tenantId,workspaceId:workspace!.workspaceId};
    const wanted=new Map<string,AdminRoleAssignment>(),timestamp=input.now();
    for(const row of desired){
      const u=kind==='user'?user:d.users.find(u=>u.number===row.number),w=kind==='workspace'?workspace:d.workspaces.find(w=>w.number===row.number);
      if(!u||!w)throw internal();
      const key=pair({adminUserId:u.adminUserId,tenantId:w.tenantId,workspaceId:w.workspaceId});
      const previous=d.roles.get(key);
      const {nativeWorkspaceRole:_oldNativeRole,...base}=previous??{roleAssignmentId:input.id(),adminUserId:u.adminUserId,
        tenantId:w.tenantId,workspaceId:w.workspaceId,groupKey:null,monitorProfiles:[],monitorBookletVisibility:'visible' as const,createdAt:timestamp};
      const recognized=row.role==='RO'||row.role==='RW';
      wanted.set(key,{...base,role:recognized?'workspace_admin':'native_workspace_opaque',accessMode:row.role==='RW'?'read_write':'read_only',
        ...recognized?{}:{nativeWorkspaceRole:row.role}});
    }
    const old=[...d.roles.values()].filter(r=>inScope(r,scope));
    const removed=old.filter(r=>!wanted.has(pair(r)));
    const assignments=[...wanted.values()].filter(r=>{const before=d.roles.get(pair(r));return !before||before.role!==r.role||before.accessMode!==r.accessMode||before.nativeWorkspaceRole!==r.nativeWorkspaceRole;});
    const audits:AdminAuditEvent[]=[...removed.map(r=>({row:r,eventType:'admin_role_revoked' as const})),...assignments.map(r=>({row:r,eventType:'admin_role_assigned' as const}))].map(({row,eventType})=>({
      adminAuditEventId:input.id(),eventType,actorAdminUserId:s.user!.adminUserId,subjectAdminUserId:row.adminUserId,occurredAt:timestamp,
      summary:'Native workspace permission '+(eventType==='admin_role_assigned'?(row.role==='native_workspace_opaque'?'membership stored without access':'assigned'):'revoked'),
      details:{native:true,roleAssignmentId:row.roleAssignmentId,role:row.role,tenantId:row.tenantId,workspaceId:row.workspaceId,accessMode:row.accessMode,
        ...row.role==='native_workspace_opaque'?{nativeWorkspaceRole:originalWorkspaceRoleValue(row)}:{}}}));
    const effect={...d.effect,directoryJson:'',roleChanges:{scope,removeIds:removed.map(r=>r.roleAssignmentId),assignments},audits};
    validateOriginalAdminRoleChanges(s,effect,{token,at:input.now(),directory:'rights',rightsWrite:true});return effect;
  });
  return {
    usersByWorkspace:({token,reference})=>run(token,false,s=>{const d=directory(s),w=d.workspaces.find(w=>w.number===originalCommandInteger(reference).toString());return {...d.effect,directoryJson:rows(d.users.map(u=>({id:u.number,name:u.username,role:w?d.roles.get(pair({adminUserId:u.adminUserId,tenantId:w.tenantId,workspaceId:w.workspaceId})):undefined})))};}),
    workspacesByUser:({token,reference})=>run(token,false,s=>{const d=directory(s),u=d.users.find(u=>u.number===originalCommandInteger(reference).toString());return {...d.effect,directoryJson:rows(d.workspaces.map(w=>({id:w.number,name:w.displayName,role:u?d.roles.get(pair({adminUserId:u.adminUserId,tenantId:w.tenantId,workspaceId:w.workspaceId})):undefined})))};}),
    replaceWorkspaceUsers:async request=>{await replace(request.token,request.reference,request.body,'workspace');},
    replaceUserWorkspaces:async request=>{await replace(request.token,request.reference,request.body,'user');}
  };
}
