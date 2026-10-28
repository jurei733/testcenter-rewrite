import type {ParticipantSession,TestRun,OriginalLoginBinding,Tenant,Workspace} from '@testcenter-rewrite-app/domain';
import type {OriginalOperationalLogin} from './original-operational-login.js';
import type {OriginalTestNumberRecord} from './original-test-number.js';
import type {OriginalCommandPacket} from './original-command-codec.js';
import {prepareOriginalCommandInsert} from './original-command-codec.js';
import {selectOwnedOriginalTestNumber} from './original-test-number.js';
import {assertOriginalTestLogInput} from './original-test-log.js';
import {prepareOriginalTestLock} from './original-test-lock.js';
import {originalParticipantGroupKeysEqual} from './original-participant-group.js';
import {FirstSliceError} from './first-slice-error.js';
import {resultParentUnavailable} from './result-artifact-parent.js';

export type OriginalCommandActor=Pick<ParticipantSession,'tenantId'|'workspaceId'|'participantSessionId'|'groupKey'> & {originalLoginKey:string};
export type OriginalCommandDelivery=OriginalTestNumberRecord & OriginalCommandPacket & {commanderParticipantSessionId:string|null;executed:boolean};
export type OriginalCommandRepository={
  reserveOriginalCommandNumber():Promise<string>;
  findOriginalCommandTarget(actor:OriginalCommandActor,testNumber:string):Promise<OriginalTestNumberRecord|null>;
  appendOriginalCommand(actor:OriginalCommandActor,command:OriginalCommandPacket,targets:OriginalTestNumberRecord[]):Promise<void>;
  listOriginalCommands(scope:OriginalTestNumberRecord,lastCommandId:string|null):Promise<OriginalCommandPacket[]>;
  acknowledgeOriginalCommand(scope:OriginalTestNumberRecord,commandNumber:string):Promise<'executed'|'already'|null>;
  touchOriginalCommandPolling(scope:OriginalTestNumberRecord,timestamp:string):Promise<boolean>;
};
type Collection<Row>=Map<string,Row>|Record<string,Row>;
export type OriginalCommandCollections={
  originalNativeCommands:Collection<OriginalCommandDelivery>;
  originalNativeCommandCounter:string;
  originalTestNumbers:Collection<OriginalTestNumberRecord>;
  originalTestRunsByNumber:Collection<string>;
  participantSessions:Collection<ParticipantSession>;
  testRuns:Collection<TestRun>;
  originalLoginBindings:Collection<OriginalLoginBinding>;
  originalOperationalLogins:Collection<OriginalOperationalLogin[]>;
  tenants:Collection<Tenant>;
  workspacesByScope:Collection<Workspace>;
};
const get=<Row>(c:Collection<Row>,key:string):Row|undefined=>c instanceof Map?c.get(key):Object.hasOwn(c,key)?c[key]:undefined;
const values=<Row>(c:Collection<Row>):Row[]=>c instanceof Map?[...c.values()]:Object.values(c);
const put=<Row>(c:Collection<Row>,key:string,value:Row):void=>{if(c instanceof Map)c.set(key,value);else Object.defineProperty(c,key,{value,writable:true,enumerable:true,configurable:true});};
const maximum=9223372036854775807n;
export function nextOriginalCommandNumber(counter:string):string{
  if(typeof counter!=='string'||!/^(?:0|[1-9][0-9]{0,18})$/.test(counter)||BigInt(counter)>maximum)throw new Error('Invalid native command counter.');
  if(BigInt(counter)===maximum)throw new Error('Native command number space is exhausted.');return(BigInt(counter)+1n).toString();
}
export function assertOriginalCommandPacket(command:OriginalCommandPacket):void{
  if(typeof command.id!=='string'||typeof command.timestamp!=='string'||!/^[1-9][0-9]{0,18}$/.test(command.id)||BigInt(command.id)>maximum||typeof command.keyword!=='string'||!Array.isArray(command.arguments)||command.arguments.some(a=>typeof a!=='string')||!/^\d{1,19}$/.test(command.timestamp))throw new TypeError('Invalid native command packet.');
  const prepared=prepareOriginalCommandInsert({...command,testNumbers:[]});
  if(prepared.keyword!==command.keyword||prepared.timestamp!==command.timestamp)throw new TypeError('Native command insertion requires canonical stored values.');
}
export type OriginalCommandActorMetadata=Pick<ParticipantSession,'tenantId'|'workspaceId'|'participantSessionId'|'originalLoginKey'|'originalNameSuffix'|'groupKey'> & {bindingGroupKey:string;enabled:boolean};
export function assertOriginalCommandActorMetadata(actor:OriginalCommandActor,metadata:OriginalCommandActorMetadata|null):void{
  if(!metadata||!metadata.enabled||metadata.participantSessionId!==actor.participantSessionId||metadata.tenantId!==actor.tenantId||metadata.workspaceId!==actor.workspaceId||metadata.originalLoginKey!==actor.originalLoginKey||typeof metadata.originalNameSuffix!=='string'||!originalParticipantGroupKeysEqual(metadata.groupKey,actor.groupKey)||!originalParticipantGroupKeysEqual(metadata.bindingGroupKey,actor.groupKey))throw new FirstSliceError(403,'original_monitor_forbidden','A current native group monitor is required.');
}
export function assertOriginalCommandActor(state:OriginalCommandCollections,actor:OriginalCommandActor):void{
  const person=get(state.participantSessions,actor.participantSessionId),binding=values(state.originalLoginBindings).find(b=>b.tenantId===actor.tenantId&&b.workspaceId===actor.workspaceId&&b.loginKey===actor.originalLoginKey);
  const enabled=values(state.tenants).some(t=>t.tenantId===actor.tenantId&&t.status==='active')&&values(state.workspacesByScope).some(w=>w.tenantId===actor.tenantId&&w.workspaceId===actor.workspaceId&&w.status==='active')&&(get(state.originalOperationalLogins,actor.tenantId+'::'+actor.workspaceId)??[]).some(login=>login.loginKey===actor.originalLoginKey&&login.loginMode==='monitor-group');
  assertOriginalCommandActorMetadata(actor,person&&binding?{...person,bindingGroupKey:binding.groupKey,enabled}:null);
}

function currentMapping(state:OriginalCommandCollections,input:OriginalTestNumberRecord):OriginalTestNumberRecord{
  assertOriginalTestLogInput(input);const mapped=selectOwnedOriginalTestNumber(input,get(state.originalTestNumbers,input.testRunId),get(state.testRuns,input.testRunId)??null,get(state.participantSessions,input.participantSessionId)??null);
  if(!mapped||get(state.originalTestRunsByNumber,input.testNumber)!==input.testRunId||(['testRunId','participantSessionId','tenantId','workspaceId','contentReleaseId'] as const).some(key=>mapped[key]!==input[key]))throw resultParentUnavailable();return mapped;
}
export function findOriginalCommandTargetCollection(state:OriginalCommandCollections,actor:OriginalCommandActor,testNumber:string):OriginalTestNumberRecord|null{
  assertOriginalCommandActor(state,actor);const runId=get(state.originalTestRunsByNumber,testNumber),mapping=runId?get(state.originalTestNumbers,runId):undefined;
  if(!mapping||mapping.tenantId!==actor.tenantId||mapping.workspaceId!==actor.workspaceId)return null;
  const person=get(state.participantSessions,mapping.participantSessionId),binding=person?values(state.originalLoginBindings).find(b=>b.tenantId===actor.tenantId&&b.workspaceId===actor.workspaceId&&b.loginKey===person.originalLoginKey):undefined;
  if(!person||!binding||!originalParticipantGroupKeysEqual(person.groupKey,actor.groupKey)||!originalParticipantGroupKeysEqual(binding.groupKey,actor.groupKey))return null;
  try{return{...currentMapping(state,mapping)};}catch{return null;}
}
export function appendOriginalCommandCollection(state:OriginalCommandCollections,actor:OriginalCommandActor,command:OriginalCommandPacket,targets:OriginalTestNumberRecord[]):void{
  assertOriginalCommandActor(state,actor);assertOriginalCommandPacket(command);
  if(BigInt(command.id)>BigInt(state.originalNativeCommandCounter)||!targets.length||new Set(targets.map(t=>t.testNumber)).size!==targets.length||values(state.originalNativeCommands).some(row=>row.id===command.id))throw new Error('Native command allocation or batch identity is invalid.');
  const rows=targets.map(target=>{const current=findOriginalCommandTargetCollection(state,actor,target.testNumber);if(!current||(['testRunId','participantSessionId','tenantId','workspaceId','contentReleaseId'] as const).some(k=>current[k]!==target[k]))throw resultParentUnavailable();return{testNumber:target.testNumber,testRunId:target.testRunId,participantSessionId:target.participantSessionId,tenantId:target.tenantId,workspaceId:target.workspaceId,contentReleaseId:target.contentReleaseId,id:command.id,keyword:command.keyword,arguments:[...command.arguments],timestamp:command.timestamp,commanderParticipantSessionId:actor.participantSessionId,executed:false};});
  for(const row of rows)put(state.originalNativeCommands,JSON.stringify([row.testRunId,row.id]),row);
}
export function selectOriginalCommands(rows:OriginalCommandDelivery[],lastCommandId:string|null):OriginalCommandPacket[]{
  const threshold=lastCommandId===null?null:rows.find(row=>row.id===lastCommandId)?.timestamp;
  if(lastCommandId!==null&&threshold===undefined)return[];
  return rows.filter(row=>!row.executed&&(threshold===null||BigInt(row.timestamp)>BigInt(threshold!)))
    .sort((a,b)=>BigInt(a.timestamp)<BigInt(b.timestamp)?-1:BigInt(a.timestamp)>BigInt(b.timestamp)?1:BigInt(a.id)<BigInt(b.id)?-1:1)
    .map(row=>({id:row.id,keyword:row.keyword,arguments:[...row.arguments],timestamp:row.timestamp}));
}
export function listOriginalCommandsCollection(state:OriginalCommandCollections,scope:OriginalTestNumberRecord,lastCommandId:string|null):OriginalCommandPacket[]{
  currentMapping(state,scope);return selectOriginalCommands(values(state.originalNativeCommands).filter(row=>row.testNumber===scope.testNumber&&row.testRunId===scope.testRunId&&row.participantSessionId===scope.participantSessionId&&row.tenantId===scope.tenantId&&row.workspaceId===scope.workspaceId&&row.contentReleaseId===scope.contentReleaseId),lastCommandId);
}
export function acknowledgeOriginalCommandCollection(state:OriginalCommandCollections,scope:OriginalTestNumberRecord,commandNumber:string):'executed'|'already'|null{
  currentMapping(state,scope);const key=JSON.stringify([scope.testRunId,commandNumber]),row=get(state.originalNativeCommands,key);if(!row||row.testNumber!==scope.testNumber||row.participantSessionId!==scope.participantSessionId||row.tenantId!==scope.tenantId||row.workspaceId!==scope.workspaceId||row.contentReleaseId!==scope.contentReleaseId)return null;
  if(row.executed)return'already';put(state.originalNativeCommands,key,{...row,executed:true});return'executed';
}
export function prepareOriginalCommandPolling(timestamp:string,state:unknown,before:TestRun['originalResultState']):Pick<TestRun,'updatedAt'|'originalResultState'>|null{
  // Canonical controller entry can leave the native state projection unknown.
  // Delivery is independent: preserve that unknown history and never infer LOST.
  if(state===undefined)return null;
  if(!state||typeof state!=='object'||Array.isArray(state))throw new FirstSliceError(409,'original_test_state_unknown','The historical saved Test state is unavailable.');
  const connection=Object.hasOwn(state,'CONNECTION')?(state as Record<string,unknown>).CONNECTION:undefined;
  // Source uses PHP loose comparison with its nonempty LOST string.
  if(connection!=='LOST'&&connection!==true)return null;
  const {updatedAt,originalResultState}=prepareOriginalTestLock(timestamp,before);return{updatedAt,originalResultState};
}
export function touchOriginalCommandPollingCollection(state:OriginalCommandCollections,scope:OriginalTestNumberRecord,timestamp:string):boolean{
  currentMapping(state,scope);const run=get(state.testRuns,scope.testRunId)!,effect=prepareOriginalCommandPolling(timestamp,run.originalTestState,run.originalResultState);if(!effect)return false;put(state.testRuns,scope.testRunId,{...run,...effect});return true;
}
