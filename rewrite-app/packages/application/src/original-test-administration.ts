import type {OriginalAdminTestSession} from '@testcenter-rewrite-app/contracts';
import type {OriginalLoginBinding,OriginalParticipantGroup,ParticipantSession,TestRun} from '@testcenter-rewrite-app/domain';
import type {FirstSliceRepository} from './index.js';
import type {OriginalTestNumberRecord} from './original-test-number.js';
import {FirstSliceError} from './first-slice-error.js';
import {compareOriginalParticipantGroupKeys,originalParticipantGroupKeysEqual} from './original-participant-group.js';
import {originalPhpMap} from './original-test-state.js';

type Scope={tenantId:string;workspaceId:string};
type Person=Pick<ParticipantSession,'participantSessionId'|'tenantId'|'workspaceId'|'contentReleaseId'|'originalLoginKey'|'originalNameSuffix'|'participantCode'|'groupKey'>;
type Binding=Pick<OriginalLoginBinding,'tenantId'|'workspaceId'|'loginKey'|'groupKey'|'groupSnapshotKey'>;
type Group=Pick<OriginalParticipantGroup,'tenantId'|'workspaceId'|'groupKey'|'groupLabel'>;
type Run=Pick<TestRun,'testRunId'|'participantSessionId'|'tenantId'|'workspaceId'|'contentReleaseId'> & {
 bookletName?:string;bookletLabel?:string;hasTestState?:boolean;
};
export type OriginalTestAdministrationInventory={people:Person[];bindings:Binding[];groups:Group[];runs:Run[];numbers:OriginalTestNumberRecord[]};
export type OriginalTestAdministrationGroup={name:string;sessions:OriginalAdminTestSession[]};
const unavailable=()=>new FirstSliceError(409,'original_test_administration_history_unknown','The native Test administration history is unavailable or ambiguous.');
const inScope=(row:Scope,scope:Scope)=>row.tenantId===scope.tenantId&&row.workspaceId===scope.workspaceId;
export function projectOriginalTestAdministrationRun(run:Pick<TestRun,'testRunId'|'participantSessionId'|'tenantId'|'workspaceId'|'contentReleaseId'|'originalResultState'>):Run{
 const state=run.originalResultState;
 return {testRunId:run.testRunId,participantSessionId:run.participantSessionId,tenantId:run.tenantId,workspaceId:run.workspaceId,contentReleaseId:run.contentReleaseId,
  ...(state?.bookletName===undefined?{}:{bookletName:state.bookletName}),...(state?.bookletLabel===undefined?{}:{bookletLabel:state.bookletLabel}),
  ...(state?.hasTestState===undefined?{}:{hasTestState:state.hasTestState})};
}
/** One owned metadata snapshot. No answers, state values, tokens or timers escape. */
export function projectOriginalTestAdministrationInventory(input:OriginalTestAdministrationInventory):OriginalTestAdministrationInventory{
 return {
  people:input.people.map(p=>({participantSessionId:p.participantSessionId,tenantId:p.tenantId,workspaceId:p.workspaceId,contentReleaseId:p.contentReleaseId,groupKey:p.groupKey,
   ...(p.originalLoginKey===undefined?{}:{originalLoginKey:p.originalLoginKey}),...(p.originalNameSuffix===undefined?{}:{originalNameSuffix:p.originalNameSuffix}),
   ...(p.participantCode===undefined?{}:{participantCode:p.participantCode})})),
  bindings:input.bindings.map(b=>({tenantId:b.tenantId,workspaceId:b.workspaceId,loginKey:b.loginKey,groupKey:b.groupKey,groupSnapshotKey:b.groupSnapshotKey})),
  groups:input.groups.map(g=>({tenantId:g.tenantId,workspaceId:g.workspaceId,groupKey:g.groupKey,groupLabel:g.groupLabel})),
  runs:input.runs.map(r=>({testRunId:r.testRunId,participantSessionId:r.participantSessionId,tenantId:r.tenantId,workspaceId:r.workspaceId,contentReleaseId:r.contentReleaseId,
   ...(r.bookletName===undefined?{}:{bookletName:r.bookletName}),...(r.bookletLabel===undefined?{}:{bookletLabel:r.bookletLabel}),...(r.hasTestState===undefined?{}:{hasTestState:r.hasTestState})})),
  numbers:input.numbers.map(n=>({testRunId:n.testRunId,participantSessionId:n.participantSessionId,tenantId:n.tenantId,workspaceId:n.workspaceId,contentReleaseId:n.contentReleaseId,testNumber:n.testNumber}))
 };
}
type Collection<T>=Map<string,T>|Record<string,T>;
const values=<T>(rows:Collection<T>):T[]=>rows instanceof Map?[...rows.values()]:Object.values(rows);
export function readOriginalTestAdministrationCollections(state:{
 participantSessions:Collection<ParticipantSession>;originalLoginBindings:Collection<OriginalLoginBinding>;
 originalParticipantGroups:Collection<OriginalParticipantGroup>;testRuns:Collection<TestRun>;originalTestNumbers:Collection<OriginalTestNumberRecord>;
},scope:Scope):OriginalTestAdministrationInventory{
 const selected=<T extends Scope>(rows:Collection<T>)=>values(rows).filter(r=>inScope(r,scope));
 return projectOriginalTestAdministrationInventory({people:selected(state.participantSessions),bindings:selected(state.originalLoginBindings),
  groups:selected(state.originalParticipantGroups),runs:selected(state.testRuns).map(projectOriginalTestAdministrationRun),numbers:selected(state.originalTestNumbers)});
}
const index=<T>(rows:T[],key:(row:T)=>string):Map<string,T[]>=>{
 const result=new Map<string,T[]>();for(const row of rows){const id=key(row),current=result.get(id)??[];current.push(row);result.set(id,current);}return result;
};
const one=<T>(rows:T[]|undefined):T=>{if(rows?.length!==1)throw unavailable();return rows[0]!;};
const number=(n:string):bigint=>{
 if(typeof n!=='string'||!(/^[1-9][0-9]{0,18}$/).test(n))throw unavailable();
 const value=BigInt(n);if(value>9223372036854775807n)throw unavailable();return value;
};
/** Source AdminDAO::getTestSessionsWithState orders by frozen snapshot group,
 * then numeric Test ID, and filters saved Test state independently of opening. */
export function projectOriginalTestAdministration(input:Scope&OriginalTestAdministrationInventory):OriginalTestAdministrationGroup[]{
 const people=index(input.people.filter(p=>inScope(p,input)&&typeof p.originalLoginKey==='string'),p=>p.participantSessionId);
 const bindings=index(input.bindings.filter(b=>inScope(b,input)),b=>b.loginKey);
 const groups=index(input.groups.filter(g=>inScope(g,input)),g=>g.groupKey);
 const numbers=index(input.numbers.filter(n=>inScope(n,input)),n=>n.testRunId);
 const ids=new Set<string>(),nativeNumbers=new Set<string>(),identities=new Map<string,string[]>(),rows:Array<{group:string;number:bigint;row:OriginalAdminTestSession}>=[];
 for(const run of input.runs){
  if(!inScope(run,input)||!people.has(run.participantSessionId))continue;
  const person=one(people.get(run.participantSessionId));
  if(typeof run.hasTestState!=='boolean')throw unavailable();
  if(!run.hasTestState)continue;
  if(ids.has(run.testRunId))throw unavailable();ids.add(run.testRunId);
  if(typeof person.originalLoginKey!=='string'||typeof person.originalNameSuffix!=='string'||(typeof person.participantCode!=='string'&&person.participantCode!==null)||person.contentReleaseId!==run.contentReleaseId)throw unavailable();
  // An observed no-code person uses null internally; missing legacy code stays undefined.
  const binding=one(bindings.get(person.originalLoginKey)),group=one(groups.get(binding.groupSnapshotKey));
  if(!originalParticipantGroupKeysEqual(binding.groupKey,person.groupKey)||!originalParticipantGroupKeysEqual(binding.groupKey,group.groupKey)||
   typeof group.groupLabel!=='string'||typeof run.bookletName!=='string'||!run.bookletName.length||typeof run.bookletLabel!=='string')throw unavailable();
  const mapping=one(numbers.get(run.testRunId));
  if(mapping.participantSessionId!==run.participantSessionId||mapping.contentReleaseId!==run.contentReleaseId)throw unavailable();
  const numeric=number(mapping.testNumber);if(nativeNumbers.has(mapping.testNumber))throw unavailable();nativeNumbers.add(mapping.testNumber);
  const known=identities.get(person.participantSessionId)??[];
  known.push(run.bookletName);identities.set(person.participantSessionId,known);
  rows.push({group:group.groupKey,number:numeric,row:{loginName:binding.loginKey,groupName:group.groupKey,groupLabel:group.groupLabel,
   code:person.participantCode??'',nameSuffix:person.originalNameSuffix,bookletName:run.bookletName,bookletLabel:run.bookletLabel}});
 }
 for(const names of identities.values()){names.sort(compareOriginalParticipantGroupKeys);for(let i=1;i<names.length;i++)if(originalParticipantGroupKeysEqual(names[i-1]!,names[i]!))throw unavailable();}
 rows.sort((a,b)=>compareOriginalParticipantGroupKeys(a.group,b.group)||(a.number<b.number?-1:a.number>b.number?1:0));
 const result:OriginalTestAdministrationGroup[]=[];for(const row of rows){
  let group=result.at(-1);if(!group||group.name!==row.group){group={name:row.group,sessions:[]};result.push(group);}group.sessions.push(row.row);
 }return result;
}
/** Preserve PHP's empty-array/numeric-group shape and native key order. */
export function formatOriginalTestAdministrationJson(groups:OriginalTestAdministrationGroup[]):string{
 return originalPhpMap(groups.map(group=>[group.name,group.sessions]));
}
export type OriginalTestAdministrationPort={list(input:{tenantKey:string;workspaceKey:string}):Promise<OriginalTestAdministrationGroup[]>};
export function createOriginalTestAdministrationPort(repository:FirstSliceRepository,workspace:(tenantKey:string,workspaceKey:string)=>Promise<Scope>):OriginalTestAdministrationPort{
 return {async list(input){const scope=await workspace(input.tenantKey,input.workspaceKey),snapshot=await repository.getOriginalTestAdministrationInventory(scope.tenantId,scope.workspaceId);return projectOriginalTestAdministration({...scope,...snapshot});}};
}

