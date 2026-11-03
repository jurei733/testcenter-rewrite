import type {OriginalLoginBinding,OriginalNativeUnit,ParticipantSession,ParticipantTestLog,TestRun} from '@testcenter-rewrite-app/domain';
import {exactParticipantTestLogTimestamp,originalUnitLogIdPrefix,originalTestLogIdPrefix,originalTestStateLogIdPrefix} from '@testcenter-rewrite-app/domain';
import type {FirstSliceRepository} from './index.js';
import type {OriginalPersonNumberRecord} from './original-person-number.js';
import type {OriginalTestNumberRecord} from './original-test-number.js';
import {selectOriginalPersonNumber} from './original-person-number.js';
import {originalParticipantGroupKeysEqual,compareOriginalParticipantGroupKeys} from './original-participant-group.js';
import {createOriginalReportTextComparator} from './original-report-collation.js';
import {assertOriginalUnitRecord,originalUnitParentMatches,type OriginalUnitScope} from './original-unit-record.js';
import {assertOriginalNativeReview,originalReviewNumber,type OriginalNativeReview} from './original-review-record.js';
import {formatOriginalParticipantLogEntry} from './original-report-csv.js';
import {formatOriginalResponseReport,formatOriginalLogReport,formatOriginalReviewReport,formatOriginalUnitStateReport,formatOriginalReviewTimestamp,
  type OriginalResponseReportRecord,type OriginalLogReportRecord,type OriginalReviewReportRecord} from './original-workspace-report-wire.js';
import {FirstSliceError} from './first-slice-error.js';

type Scope={tenantId:string;workspaceId:string};
type Person=Pick<ParticipantSession,'participantSessionId'|'tenantId'|'workspaceId'|'contentReleaseId'|'groupKey'|'originalLoginKey'|'originalNameSuffix'>;
type Binding=Pick<OriginalLoginBinding,'tenantId'|'workspaceId'|'loginKey'|'groupKey'>;
export type OriginalReportRun=OriginalUnitScope&{bookletName?:string};
export type OriginalReportMetadata={people:Person[];bindings:Binding[];runs:OriginalReportRun[]};
export type OriginalReportParent={run:OriginalReportRun;person:Person;bindings:Binding[]};
export type OriginalReportRequest=Scope&{type:'response'|'log'|'review';groups:string[]|null};
type UnitIdentity=OriginalUnitScope&Pick<OriginalNativeUnit,'unitName'|'originalUnitId'>;
export type OriginalReportStoredUnit=OriginalUnitScope&{unitName:string;unit:UnitIdentity|OriginalNativeUnit};
export type OriginalReportStoredReview=OriginalUnitScope&{kind:string;reviewNumber:string;reviewId:string;review:OriginalNativeReview};
type LegacyUnit={testRunId:string;unitName:string};
export type OriginalReportFamily={units:OriginalReportStoredUnit[];legacyUnits:LegacyUnit[];logs:ParticipantTestLog[];reviews:OriginalReportStoredReview[];
  legacyReviews:Array<{testRunId:string;reviewId:string}>;testNumbers:OriginalTestNumberRecord[];personNumbers:OriginalPersonNumberRecord[]};
type ReviewData=Omit<OriginalReviewReportRecord,'page'|'reviewtime'>&{page:string|null;updatedAt:string};
export type OriginalWorkspaceReportSnapshot={type:'response';rows:OriginalResponseReportRecord[]}|{type:'log';rows:OriginalLogReportRecord[]}|{type:'review';rows:ReviewData[]};
const unavailable=()=>new FirstSliceError(409,'original_report_history_unknown','The selected native report history is unavailable or ambiguous.');
export function assertOriginalReportRowCount(count:number):void {
  if(count>50_000)throw new FirstSliceError(413,'result_archive_too_large','The selected result archive exceeds the 50,000-row per report limit. Select fewer groups.');
}
const inScope=(a:Scope,b:Scope)=>a.tenantId===b.tenantId&&a.workspaceId===b.workspaceId;
/** Group selection precedes family validation. No answer, state or credential is read. */
export function selectOriginalReportParents(metadata:OriginalReportMetadata,input:OriginalReportRequest):OriginalReportParent[]{
  if(input.groups!==null&&new Set(input.groups).size>100)throw new FirstSliceError(400,'result_archive_group_limit_exceeded','At most 100 result groups can be exported at once.');
  const people=new Map(metadata.people.filter(p=>inScope(p,input)&&typeof p.originalLoginKey==='string').map(p=>[p.participantSessionId,p]));
  const byLogin=new Map<string,Binding[]>();for(const binding of metadata.bindings.filter(b=>inScope(b,input))){const rows=byLogin.get(binding.loginKey)??[];rows.push(binding);byLogin.set(binding.loginKey,rows);}
  return metadata.runs.filter(r=>inScope(r,input)&&people.has(r.participantSessionId)).flatMap(run=>{
    const person=people.get(run.participantSessionId)!,bindings=byLogin.get(person.originalLoginKey!)??[];
    const group=bindings[0]?.groupKey??person.groupKey;
    return input.groups!==null&&!input.groups.some(value=>originalParticipantGroupKeysEqual(value,group))?[]:[{run,person,bindings}];
  });
}
function identity(parent:OriginalReportParent){
  const {run,person,bindings}=parent,binding=bindings[0];
  if(bindings.length!==1||!binding||!inScope(run,person)||run.contentReleaseId!==person.contentReleaseId||run.participantSessionId!==person.participantSessionId||
    typeof person.originalLoginKey!=='string'||typeof person.originalNameSuffix!=='string'||typeof run.bookletName!=='string'||!run.bookletName||
    !originalParticipantGroupKeysEqual(binding.groupKey,person.groupKey))throw unavailable();
  return {groupname:binding.groupKey,loginname:binding.loginKey,code:person.originalNameSuffix,bookletname:run.bookletName};
}
function ownedUnit(parent:OriginalReportParent,stored:OriginalReportStoredUnit):UnitIdentity {
  if(!originalUnitParentMatches(parent.run,stored)||!originalUnitParentMatches(stored,stored.unit)||stored.unitName!==stored.unit.unitName||typeof stored.unit.originalUnitId!=='string')throw unavailable();
  return stored.unit;
}
/** Only the requested family is materialized. Unit identities in log/review
 * snapshots contain neither state nor response parts. Raw branch order stays intact. */
export function projectOriginalWorkspaceReport(input:OriginalReportRequest,parents:OriginalReportParent[],family:OriginalReportFamily):OriginalWorkspaceReportSnapshot {
  const byRun=new Map(parents.map(p=>[p.run.testRunId,p]));
  const unitsByRun=new Map<string,OriginalReportStoredUnit[]>();for(const unit of family.units){const rows=unitsByRun.get(unit.testRunId)??[];rows.push(unit);unitsByRun.set(unit.testRunId,rows);}
  const sorted=new Set<string>();
  const findUnit=(run:OriginalUnitScope,name:string):OriginalReportStoredUnit|undefined=>{
    const units=unitsByRun.get(run.testRunId)??[];
    if(!sorted.has(run.testRunId)){units.sort((a,b)=>compareOriginalParticipantGroupKeys(a.unitName,b.unitName));
      for(let i=1;i<units.length;i++)if(originalParticipantGroupKeysEqual(units[i-1]!.unitName,units[i]!.unitName))throw unavailable();sorted.add(run.testRunId);}
    let low=0,high=units.length;while(low<high){const middle=(low+high)>>>1;if(compareOriginalParticipantGroupKeys(units[middle]!.unitName,name)<0)low=middle+1;else high=middle;}
    return units[low]&&originalParticipantGroupKeysEqual(units[low]!.unitName,name)?units[low]:undefined;
  };
  if(input.type==='response'){
    assertOriginalReportRowCount(family.units.length);
    const compare=createOriginalReportTextComparator(),rows:OriginalResponseReportRecord[]=[];
    for(const stored of family.units){
      const parent=byRun.get(stored.testRunId);if(!parent)throw unavailable();
      const unit=ownedUnit(parent,stored) as OriginalNativeUnit;assertOriginalUnitRecord(unit);
      if(unit.unknownHistory||unit.stateInitialized===undefined&&!Object.keys(unit.state).length&&!Object.keys(unit.stateClocks).length)throw unavailable();
      rows.push({...identity(parent),unitname:unit.unitName,originalUnitId:unit.originalUnitId,
        laststate:unit.stateInitialized===true||Object.keys(unit.state).length||Object.keys(unit.stateClocks).length?formatOriginalUnitStateReport(unit.state):null,
        responses:unit.parts.map(p=>({...p})).sort((a,b)=>compare(a.id,b.id))});
    }
    for(const stored of family.units)findUnit(stored,stored.unitName);
    for(const legacy of family.legacyUnits){const parent=byRun.get(legacy.testRunId);if(!parent||!findUnit(parent.run,legacy.unitName))throw unavailable();}
    rows.sort((a,b)=>compare(a.groupname,b.groupname)||compare(a.loginname,b.loginname)||compare(a.code,b.code)||compare(a.bookletname,b.bookletname)||compare(a.unitname,b.unitname)||compare(a.originalUnitId,b.originalUnitId));
    return {type:'response',rows};
  }
  const unitsFor=(parent:OriginalReportParent,name:string):UnitIdentity=>{
    const stored=findUnit(parent.run,name);if(!stored)throw unavailable();return ownedUnit(parent,stored);
  };
  if(input.type==='log'){
    assertOriginalReportRowCount(family.logs.length);
    const rows=[...family.logs.filter(l=>l.unitKey!==null),...family.logs.filter(l=>l.unitKey===null)].map(log=>{
      const parent=byRun.get(log.testRunId);if(!parent||!inScope(parent.run,log)||log.participantSessionId!==parent.run.participantSessionId||
        ![originalUnitLogIdPrefix,originalTestLogIdPrefix,originalTestStateLogIdPrefix].some(prefix=>log.participantTestLogId.startsWith(prefix))||
        !Number.isInteger(log.timestamp)||!Number.isSafeInteger(log.timestamp)&&log.originalClientTimestamp===undefined)throw unavailable();
      exactParticipantTestLogTimestamp(log);
      const unit=log.unitKey===null?null:unitsFor(parent,log.unitKey);
      return {...identity(parent),unitname:unit?.unitName??'',originalUnitId:unit?.originalUnitId??'',timestamp:log.timestamp,
        ...(log.originalClientTimestamp===undefined?{}:{originalClientTimestamp:log.originalClientTimestamp}),logentry:formatOriginalParticipantLogEntry(log)};
    });
    return {type:'log',rows};
  }
  assertOriginalReportRowCount(family.reviews.length);
  const known=new Set(family.reviews.map(r=>r.reviewId));
  if(family.legacyReviews.some(r=>!known.has(r.reviewId)))throw unavailable();
  const testsByRun=new Map<string,OriginalTestNumberRecord[]>(),peopleBySession=new Map<string,OriginalPersonNumberRecord[]>();
  for(const number of family.testNumbers){const rows=testsByRun.get(number.testRunId)??[];rows.push(number);testsByRun.set(number.testRunId,rows);}
  for(const number of family.personNumbers){const rows=peopleBySession.get(number.participantSessionId)??[];rows.push(number);peopleBySession.set(number.participantSessionId,rows);}
  const rows=[...family.reviews.filter(r=>r.review.unitName!==null),...family.reviews.filter(r=>r.review.unitName===null)].map(stored=>{
    const parent=byRun.get(stored.testRunId),review=stored.review;if(!parent)throw unavailable();assertOriginalNativeReview(review);
    if(!originalUnitParentMatches(parent.run,stored)||!originalUnitParentMatches(stored,review)||stored.kind!==(review.unitName===null?'test':'unit')||stored.reviewNumber!==review.reviewNumber||stored.reviewId!==review.reviewId)throw unavailable();
    const tests=testsByRun.get(review.testRunId)??[],people=peopleBySession.get(review.participantSessionId)??[];
    if(tests.length!==1||people.length!==1||!originalUnitParentMatches(parent.run,tests[0])||originalReviewNumber(tests[0]!.testNumber)!==review.testNumber||
      typeof parent.person.originalLoginKey!=='string'||typeof parent.person.originalNameSuffix!=='string'||
      selectOriginalPersonNumber({...parent.person,originalLoginKey:parent.person.originalLoginKey,originalNameSuffix:parent.person.originalNameSuffix},people[0],parent.person)!==review.personNumber)throw unavailable();
    const unit=review.unitName===null?null:unitsFor(parent,review.unitName);
    return {...identity(parent),unitname:unit?.unitName??'',originalUnitId:unit?.originalUnitId??'',priority:review.priority,categories:review.categories,
      updatedAt:review.updatedAt,entry:review.entry,page:review.page,pagelabel:review.pageLabel,userAgent:review.userAgent,reviewer:review.reviewer};
  });
  return {type:'review',rows};
}
type Collection<T>=Map<string,T>|Record<string,T>;
const values=<T>(c:Collection<T>):T[]=>c instanceof Map?[...c.values()]:Object.values(c);
const scopeKeys=['testRunId','participantSessionId','tenantId','workspaceId','contentReleaseId'] as const;
export function originalReportUnitIdentity(unit:OriginalNativeUnit):UnitIdentity{return {...Object.fromEntries(scopeKeys.map(k=>[k,unit[k]])),unitName:unit.unitName,originalUnitId:unit.originalUnitId} as UnitIdentity;}
export function readOriginalWorkspaceReportCollections(state:{participantSessions:Collection<ParticipantSession>;originalLoginBindings:Collection<OriginalLoginBinding>;testRuns:Collection<TestRun>;
  originalNativeUnits:Collection<OriginalNativeUnit>;participantTestLogs:Collection<ParticipantTestLog>;originalNativeReviews:Collection<OriginalNativeReview>;
  workspaceReviews:Collection<{testRunId:string;reviewId:string;unitKey:string|null}>;workspaceActivityEvents:Collection<{subjectId:string;subjectType:string;eventType:string;details:unknown}>;
  originalTestNumbers:Collection<OriginalTestNumberRecord>;originalPersonNumbers:Collection<OriginalPersonNumberRecord>},input:OriginalReportRequest):OriginalWorkspaceReportSnapshot {
  const parents=selectOriginalReportParents({people:values(state.participantSessions),bindings:values(state.originalLoginBindings),runs:values(state.testRuns).map(r=>({
    ...Object.fromEntries(scopeKeys.map(k=>[k,r[k]])),bookletName:r.originalResultState?.bookletName} as OriginalReportRun))},input);
  const selected=new Set(parents.map(p=>p.run.testRunId)),family:OriginalReportFamily={units:[],legacyUnits:[],logs:[],reviews:[],legacyReviews:[],testNumbers:[],personNumbers:[]};
  if(input.type==='response'){
    family.units=values(state.originalNativeUnits).filter(u=>selected.has(u.testRunId)).map(unit=>({...originalReportUnitIdentity(unit),unit}));
    family.legacyUnits=values(state.testRuns).filter(r=>selected.has(r.testRunId)).flatMap(r=>Object.keys(r.unitResponses).map(unitName=>({testRunId:r.testRunId,unitName})));
    family.legacyUnits.push(...values(state.workspaceReviews).filter(r=>selected.has(r.testRunId)&&r.unitKey!==null).map(r=>({testRunId:r.testRunId,unitName:r.unitKey!})));
    for(const event of values(state.workspaceActivityEvents))if(event.subjectType==='test_run'&&selected.has(event.subjectId)&&['review_created','review_updated','review_deleted'].includes(event.eventType)){
      const key=event.details&&typeof event.details==='object'?(event.details as {unitKey?:unknown}).unitKey:undefined;
      if(typeof key==='string')family.legacyUnits.push({testRunId:event.subjectId,unitName:key});
    }
  }else{
    family.units=values(state.originalNativeUnits).filter(u=>selected.has(u.testRunId)).map(unit=>({...originalReportUnitIdentity(unit),unit:originalReportUnitIdentity(unit)}));
    if(input.type==='log')family.logs=values(state.participantTestLogs).filter(l=>selected.has(l.testRunId));
    else{
      family.reviews=values(state.originalNativeReviews).filter(r=>selected.has(r.testRunId)).map(review=>({...review,kind:review.unitName===null?'test':'unit',review}));
      family.legacyReviews=values(state.workspaceReviews).filter(r=>selected.has(r.testRunId)).map(r=>({testRunId:r.testRunId,reviewId:r.reviewId}));
      family.testNumbers=values(state.originalTestNumbers).filter(n=>selected.has(n.testRunId));
      const people=new Set(parents.map(p=>p.person.participantSessionId));family.personNumbers=values(state.originalPersonNumbers).filter(n=>people.has(n.participantSessionId));
    }
  }
  return projectOriginalWorkspaceReport(input,parents,family);
}
export function originalReportFormat(accept:string):'csv'|'json'{
  for(const entry of accept.split(',')){const type=entry.split(';')[0]!.replace(/^[ \t\n\r\0\v]+|[ \t\n\r\0\v]+$/g,'').toLowerCase();if(type==='text/csv')return 'csv';if(type==='application/json')return 'json';}return 'json';
}
/** PHP query parsing may produce an array; a scalar must not silently become
 * an unfiltered all-groups request. Later duplicate scalar keys overwrite it. */
export function originalReportQuery(params:URLSearchParams,key:string):string|null{
  let value:string|null='';for(const [name,text]of params){if(name===key)value=text;else if(name.startsWith(key+'['))value=null;}return value;
}
export function createOriginalWorkspaceReportPort(input:{repository:FirstSliceRepository;workspace:(tenantKey:string,workspaceKey:string)=>Promise<Scope>;timeZone:string;
  labels:(scope:Scope,name:string)=>Promise<{bookletLabel:string;unitLabels:Record<string,string>}>}){
  return {async read(request:{tenantKey:string;workspaceKey:string;type:'response'|'log'|'review';dataIds:string|null;accept:string;useNewVersion:boolean}):Promise<{body:string;contentType:string}>{
    if(request.dataIds===null)throw new FirstSliceError(500,'original_report_query_invalid','Internal error.');
    const groups=request.dataIds===''?null:request.dataIds.split(','),scope=await input.workspace(request.tenantKey,request.workspaceKey),format=originalReportFormat(request.accept);
    const snapshot=await input.repository.getOriginalWorkspaceReportSnapshot({...scope,type:request.type,groups});let body:string;
    if(snapshot.type==='response')body=formatOriginalResponseReport(snapshot.rows,format);
    else if(snapshot.type==='log')body=formatOriginalLogReport(snapshot.rows,format);
    else{
      const labels=new Map<string,Awaited<ReturnType<typeof input.labels>>>();
      if(request.useNewVersion)for(const row of snapshot.rows)if(!labels.has(row.bookletname))labels.set(row.bookletname,await input.labels(scope,row.bookletname));
      body=formatOriginalReviewReport({format,useNewVersion:request.useNewVersion,rows:snapshot.rows.map(({updatedAt,page,...row})=>({...row,
        page:page===null?null:(JSON as unknown as {rawJSON:(text:string)=>{readonly rawJSON:string}}).rawJSON(page),reviewtime:formatOriginalReviewTimestamp(updatedAt,input.timeZone)})),
        labels:(booklet,unit)=>({bookletlabel:labels.get(booklet)?.bookletLabel??'',unitlabel:labels.get(booklet)?.unitLabels[unit]??''})});
    }
    return {body,contentType:format==='csv'?'text/csv;charset=UTF-8':'application/json'};
  }};
}
