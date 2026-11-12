import type {AdminRoleAssignment,OperationalLoginMigrationCandidate,OriginalLoginBinding,ParticipantSession,SourcePackage,SystemCheckReport,SystemCheckReportEntry,Tenant,Workspace,WorkspaceActivityEvent} from '@testcenter-rewrite-app/domain';
import type {OriginalOperationalLogin} from './original-operational-login.js';
import {prepareOriginalOperationalLogins} from './original-operational-login.js';
import type {ParticipantAccessCredential} from './participant-access.js';
import type {OriginalWorkspaceNumberRecord} from './original-workspace-number.js';
import {readOriginalWorkspaceAdministrationCollection,parseOriginalWorkspaceNumber,type OriginalWorkspaceAdministrationScope} from './original-workspace-administration.js';
import type {OriginalAuthenticationPort} from './original-authentication.js';
import {hashOriginalSessionToken} from './original-session-token.js';
import {FirstSliceError} from './first-slice-error.js';
import {encodeOriginalReportJson} from './original-workspace-report-wire.js';
import {readOriginalSystemCheckDefinition,readOriginalSystemCheckUnit,formatOriginalSystemCheckConfig,originalSystemCheckUpper,type OriginalSystemCheckFileDependencies} from './original-system-check-file.js';
import {formatOriginalSystemCheckDirectory,type OriginalSystemCheckDirectorySnapshot} from './original-workspace-content-type.js';

export type OriginalSystemCheckSelector={tenantId:string;workspaceId:string;workspaceNumber:string;actorId?:string;tokenHash?:string};
export type OriginalSystemCheckSnapshot={scope:OriginalWorkspaceAdministrationScope|null;person:ParticipantSession|null;credential:ParticipantAccessCredential|null;
 binding:OriginalLoginBinding|null;candidates:OperationalLoginMigrationCandidate[];privateLogins:OriginalOperationalLogin[];systemCheckLoginRequired:boolean;
 sourcePackages:SourcePackage[];activityEvents:WorkspaceActivityEvent[]};
export type OriginalSystemCheckEffect<Value>={value:Value;event?:WorkspaceActivityEvent};
export type OriginalSystemCheckRepository={readOriginalSystemCheckMode():Promise<boolean>;readOriginalSystemCheckDirectory():Promise<OriginalSystemCheckDirectorySnapshot>;transactOriginalSystemCheck<Value>(selector:OriginalSystemCheckSelector,
 transform:(snapshot:OriginalSystemCheckSnapshot)=>OriginalSystemCheckEffect<Value>):Promise<Value>};
type Collection<Row>=Map<string,Row>|Record<string,Row>;
const values=<Row>(rows:Collection<Row>):Row[]=>rows instanceof Map?[...rows.values()]:Object.values(rows);
const get=<Row>(rows:Collection<Row>,key:string):Row|undefined=>rows instanceof Map?rows.get(key):rows[key];
export type OriginalSystemCheckCollections={tenants:Collection<Tenant>;workspacesByScope:Collection<Workspace>;originalWorkspaceNumbers?:Collection<OriginalWorkspaceNumberRecord>;
 participantSessions:Collection<ParticipantSession>;participantAccessCredentials:Collection<ParticipantAccessCredential>;originalLoginBindings:Collection<OriginalLoginBinding>;
 operationalLoginMigrationCandidates:Collection<OperationalLoginMigrationCandidate[]>;originalOperationalLogins?:Collection<OriginalOperationalLogin[]>;
 adminRoleAssignments:Collection<AdminRoleAssignment>;sourcePackages:Collection<SourcePackage>;workspaceActivityEvents:Collection<WorkspaceActivityEvent>};
export function readOriginalSystemCheckCollections(state:OriginalSystemCheckCollections,selector:OriginalSystemCheckSelector):OriginalSystemCheckSnapshot{
 const scope=readOriginalWorkspaceAdministrationCollection(state,selector.workspaceNumber),person=selector.actorId?get(state.participantSessions,selector.actorId)??null:null;
 const scoped=(row:{tenantId:string;workspaceId:string})=>row.tenantId===selector.tenantId&&row.workspaceId===selector.workspaceId;
 return{scope:scope&&scoped(scope)?scope:null,person,credential:selector.actorId?get(state.participantAccessCredentials,selector.actorId)??null:null,
  binding:person?values(state.originalLoginBindings).find(row=>scoped(row)&&row.loginKey===person.originalLoginKey)??null:null,
  candidates:get(state.operationalLoginMigrationCandidates,selector.tenantId+'::'+selector.workspaceId)??[],
  privateLogins:get(state.originalOperationalLogins??{},selector.tenantId+'::'+selector.workspaceId)??[],systemCheckLoginRequired:values(state.adminRoleAssignments).some(row=>row.role==='system_check'),
  sourcePackages:values(state.sourcePackages).filter(scoped),activityEvents:values(state.workspaceActivityEvents).filter(scoped)};
}
export function prepareOriginalSystemCheckEffect<Value>(selector:OriginalSystemCheckSelector,snapshot:OriginalSystemCheckSnapshot,
 transform:(snapshot:OriginalSystemCheckSnapshot)=>OriginalSystemCheckEffect<Value>):OriginalSystemCheckEffect<Value>{
 if(!snapshot.scope||snapshot.scope.tenantId!==selector.tenantId||snapshot.scope.workspaceId!==selector.workspaceId)throw new FirstSliceError(404,'original_workspace_not_found','Workspace `'+selector.workspaceNumber+'` not found.');
 const effect=structuredClone(transform(structuredClone(snapshot))),event=effect.event;
 if(event){const report=event.details.report as SystemCheckReport|undefined;
  if(!event.activityEventId||snapshot.activityEvents.some(row=>row.activityEventId===event.activityEventId)||event.tenantId!==selector.tenantId||event.workspaceId!==selector.workspaceId||
   event.eventType!=='system_check_report_saved'||event.subjectType!=='system_check_report'||!report||report.tenantId!==selector.tenantId||report.workspaceId!==selector.workspaceId||
   report.systemCheckReportId!==event.subjectId||!report.systemCheckReportId||!snapshot.sourcePackages.some(source=>source.sourcePackageId===report.sourcePackageId))throw Error('Invalid native Systemcheck report effect.');
 }
 return effect;
}
export function transactOriginalSystemCheckCollections<Value>(state:OriginalSystemCheckCollections,selector:OriginalSystemCheckSelector,
 transform:(snapshot:OriginalSystemCheckSnapshot)=>OriginalSystemCheckEffect<Value>):Value{
 const effect=prepareOriginalSystemCheckEffect(selector,readOriginalSystemCheckCollections(state,selector),transform);
 if(effect.event){if(get(state.workspaceActivityEvents,effect.event.activityEventId))throw Error('Native Systemcheck activity identity collision.');
  if(state.workspaceActivityEvents instanceof Map)state.workspaceActivityEvents.set(effect.event.activityEventId,effect.event);else state.workspaceActivityEvents[effect.event.activityEventId]=effect.event;}
 return structuredClone(effect.value);
}
type Request={token?:string;workspaceNumber:string;checkName:string};
export type OriginalSystemCheckPort={mode():Promise<boolean>;list():Promise<string|null>;authorize(input:Request&{write:boolean}):Promise<void>;config(input:Request):Promise<string>;unit(input:Request):Promise<{player_id:string;def:string;player:string}>;saveReport(input:Request&{body:unknown}):Promise<void>};
const invalid=()=>new FirstSliceError(403,'original_system_check_forbidden','A current Systemcheck person for this workspace is required.');
function entries(section:string,value:unknown):SystemCheckReportEntry[]{
 if(value==null)return[];
 if(!Array.isArray(value)||value.length>200)throw new FirstSliceError(400,'system_check_report_invalid','Invalid Systemcheck report section: '+section);
 return value.map((item,index)=>{
  if(!item||typeof item!=='object'||Array.isArray(item))throw new FirstSliceError(400,'system_check_report_invalid','Invalid Systemcheck report entry.');
  const row=item as Record<string,unknown>;
  if(typeof row.label!=='string'||!row.label.trim()||!['string','number','boolean'].includes(typeof row.value)&&row.value!==null||typeof row.value==='number'&&!Number.isFinite(row.value))throw new FirstSliceError(400,'system_check_report_invalid','Invalid Systemcheck report entry.');
  return{id:typeof row.id==='string'?row.id:String(index),type:typeof row.type==='string'?row.type:section,label:row.label,value:row.value as SystemCheckReportEntry['value'],warning:Boolean(row.warning)};
 });
}
export function createOriginalSystemCheckPort(deps:{repository:OriginalSystemCheckRepository&{findOriginalWorkspaceAdministrationScope(number:string):Promise<OriginalWorkspaceAdministrationScope|null>};auth:OriginalAuthenticationPort;
 files:OriginalSystemCheckFileDependencies;now:()=>string;id:()=>string;date:(timestamp:string)=>string;
 accessWindow:(candidate:OperationalLoginMigrationCandidate,person:ParticipantSession,timestamp:string)=>void}):OriginalSystemCheckPort{
 const selector=async(request:Request):Promise<OriginalSystemCheckSelector>=>{
  let person:ParticipantSession|undefined;
  if(request.token){let state;try{state=await deps.auth.read({token:request.token});}catch(error){if(error instanceof FirstSliceError&&error.statusCode===401)throw new FirstSliceError(403,'original_session_invalid','Invalid token.');throw error;}
   if(state.kind!=='person')throw invalid();person=state.participantSession;
   if(person.originalOperationalMode!=='sys-check-login')throw invalid();
  }
  const number=parseOriginalWorkspaceNumber(request.workspaceNumber),scope=number?await deps.repository.findOriginalWorkspaceAdministrationScope(number):null;
  if(!scope||!number)throw new FirstSliceError(404,'original_workspace_not_found','Workspace `'+request.workspaceNumber+'` not found.');
  if(person&&(person.tenantId!==scope.tenantId||person.workspaceId!==scope.workspaceId))throw invalid();
  return{...scope,workspaceNumber:number,...person?{actorId:person.participantSessionId,tokenHash:hashOriginalSessionToken(request.token!)}:{}};
 };
 const authorize=(s:OriginalSystemCheckSnapshot,target:OriginalSystemCheckSelector):ParticipantSession|null=>{
  if(!target.actorId)return null;
  const person=s.person;
  if(!person||person.participantSessionId!==target.actorId||person.tenantId!==target.tenantId||person.workspaceId!==target.workspaceId||person.originalLoginKey===undefined||
   s.credential?.participantSessionId!==target.actorId||!target.tokenHash||s.credential.tokenHash!==target.tokenHash)throw new FirstSliceError(403,'original_session_invalid','Invalid token.');
  const candidates=s.candidates.filter(row=>row.loginKey===person.originalLoginKey),native=s.privateLogins.filter(row=>row.loginKey===person.originalLoginKey);
  if(candidates.length!==1||native.length!==1||native[0]!.loginMode!=='sys-check-login'||candidates[0]!.loginMode!=='sys-check-login'||!s.binding||s.binding.loginKey!==person.originalLoginKey||s.binding.tenantId!==target.tenantId||s.binding.workspaceId!==target.workspaceId)throw invalid();
  prepareOriginalOperationalLogins(candidates,native);deps.accessWindow(candidates[0]!,person,deps.now());return person;
 };
 return{
  mode:()=>deps.repository.readOriginalSystemCheckMode(),
  async list(){return formatOriginalSystemCheckDirectory(await deps.repository.readOriginalSystemCheckDirectory(),deps.files.project);},
  async authorize(request){const target=await selector(request);await deps.repository.transactOriginalSystemCheck(target,s=>{const person=authorize(s,target);if(request.write&&!person&&s.systemCheckLoginRequired)throw new FirstSliceError(401,'system_check_login_required','A dedicated system-check login is required while system-check login mode is active.');return{value:undefined};});},
  async config(request){const target=await selector(request);return deps.repository.transactOriginalSystemCheck(target,s=>{authorize(s,target);return{value:formatOriginalSystemCheckConfig(readOriginalSystemCheckDefinition(s,request.checkName,target.workspaceNumber,deps.files),target.workspaceNumber)};});},
  async unit(request){const target=await selector(request);return deps.repository.transactOriginalSystemCheck(target,s=>{authorize(s,target);const check=readOriginalSystemCheckDefinition(s,request.checkName,target.workspaceNumber,deps.files);return{value:readOriginalSystemCheckUnit(s,check,deps.files)};});},
  async saveReport(request){const target=await selector(request);await deps.repository.transactOriginalSystemCheck(target,s=>{
   const person=authorize(s,target);
   if(!person&&s.systemCheckLoginRequired)throw new FirstSliceError(401,'system_check_login_required','A dedicated system-check login is required while system-check login mode is active.');
   const check=readOriginalSystemCheckDefinition(s,request.checkName,target.workspaceNumber,deps.files);
   if(!check.saveKey)throw new FirstSliceError(409,'system_check_report_saving_disabled','This Systemcheck does not allow reports to be saved.');
   if(!request.body||typeof request.body!=='object'||Array.isArray(request.body))throw new FirstSliceError(400,'system_check_report_invalid','Invalid Systemcheck report.');
   const body=request.body as Record<string,unknown>,key=typeof body.keyPhrase==='string'&&body.keyPhrase!=='0'?body.keyPhrase:'';
   if(!person&&!key.length)throw new FirstSliceError(400,'system_check_save_key_missing','No key `'+key+'`');
   if(!person&&originalSystemCheckUpper(key)!==check.saveKey)throw new FirstSliceError(403,'system_check_save_key_invalid','Wrong key `'+key+'`');
   for(const name of ['title','date'] as const)if(body[name]!=null&&typeof body[name]!=='string')throw new FirstSliceError(400,'system_check_report_invalid','Invalid Systemcheck report '+name+'.');
   const timestamp=deps.now(),id=deps.id(),responses=body.responses;
   const report:SystemCheckReport={systemCheckReportId:id,tenantId:target.tenantId,workspaceId:target.workspaceId,sourcePackageId:check.sourcePackageId,
    // Source DataCollection retains an explicit empty string, but treats the
    // string "0" as false and keeps the constructor's default value instead.
    originalFileName:'report_'+id+'.json',fileModifiedAt:timestamp,sourceDate:typeof body.date==='string'&&body.date!=='0'?body.date:deps.date(timestamp),
    checkId:check.name,checkLabel:check.label,title:person?person.loginKey:typeof body.title==='string'&&body.title!=='0'?body.title:'',
    responses:responses==null||responses===false||responses===0||responses==='0'||Array.isArray(responses)&&responses.length===0?'':responses,
    environment:entries('environment',body.environment),network:entries('network',body.network),questionnaire:entries('questionnaire',body.questionnaire),unit:entries('unit',body.unit),createdAt:timestamp};
   encodeOriginalReportJson(report);
   return{value:undefined,event:{activityEventId:deps.id(),tenantId:target.tenantId,workspaceId:target.workspaceId,eventType:'system_check_report_saved',actorId:person?.participantSessionId??null,
    subjectType:'system_check_report',subjectId:id,occurredAt:timestamp,summary:`System-check report '${report.title}' saved for '${report.checkId}'.`,details:{report}}};
  });}
 };
}
