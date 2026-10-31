import type {OriginalReportFormat} from '@testcenter-rewrite-app/contracts';
import type {FirstSliceRepository} from './index.js';
import type {OriginalAuthenticationPort} from './original-authentication.js';
import {readOriginalPerson,resolveOriginalOwnedTestScope} from './original-test-access.js';
import {formatOriginalReviewListJson,requireOriginalReviewMode,originalReviewNumber,originalReviewHistoryUnavailable,
  type OriginalReviewScope} from './original-review-record.js';
import {formatOriginalReviewReport,formatOriginalReviewTimestamp,type OriginalReviewReportRecord,type OriginalReportLabels} from './original-workspace-report-wire.js';

type Request={token:string;testNumber:string;unitName:string|null};
export type OriginalReviewPort={
  authorize(input:Request&{write:boolean}):Promise<OriginalReviewScope>;
  list(input:Request):Promise<string>;
  create(input:Request&{body:unknown}):Promise<void>;
  update(input:Request&{reviewNumber:string;body:unknown}):Promise<void>;
  delete(input:Request&{reviewNumber:string}):Promise<void>;
  export(input:{token:string;format:OriginalReportFormat}):Promise<{status:200|204;body:string}>;
};
export function createOriginalReviewPort(input:{repository:FirstSliceRepository;auth:OriginalAuthenticationPort;now:()=>string;id:()=>string;
  timeZone:string;labels:(scope:{tenantId:string;workspaceId:string},bookletName:string)=>Promise<{bookletLabel:string;unitLabels:Record<string,string>}>}):OriginalReviewPort{
  const authorize=async(request:Request&{write:boolean})=>{
    if(request.write)requireOriginalReviewMode(await readOriginalPerson(input.auth,request.token));
    const owned=await resolveOriginalOwnedTestScope(input,request.token,request.testNumber);
    return{...owned.scope,unitName:request.unitName};
  };
  return{authorize,
    async list(request){const scope=await authorize({...request,write:false});return formatOriginalReviewListJson(await input.repository.listOriginalReviews(scope));},
    async create(request){const scope=await authorize({...request,write:true});await input.repository.mutateOriginalReview(scope,{action:'create',body:request.body,reviewId:input.id(),at:input.now()});},
    async update(request){const scope=await authorize({...request,write:true});await input.repository.mutateOriginalReview(scope,{action:'update',reviewNumber:originalReviewNumber(request.reviewNumber),body:request.body,at:input.now()});},
    async delete(request){const scope=await authorize({...request,write:true});await input.repository.mutateOriginalReview(scope,{action:'delete',reviewNumber:originalReviewNumber(request.reviewNumber)});},
    async export(request){
      const person=await readOriginalPerson(input.auth,request.token),reviews=await input.repository.listOriginalReviewsByPerson(person);
      if(!reviews.length)return{status:request.format==='csv'?204:200,body:request.format==='csv'?'':'[]'};
      const [bindings,tests]=await Promise.all([input.repository.listOriginalLoginBindingsByWorkspace(person.tenantId,person.workspaceId),input.repository.listOriginalPersonTestIdentities(person)]);
      const binding=bindings.find(row=>row.loginKey===person.originalLoginKey);
      if(!binding||person.originalNameSuffix===undefined)throw originalReviewHistoryUnavailable();
      const labels=new Map<string,{bookletLabel:string;unitLabels:Record<string,string>}>(),rows:OriginalReviewReportRecord[]=[];
      // Source ReviewDAO concatenates the Unit rows followed by Booklet rows.
      for(const review of [...reviews.filter(row=>row.unitName!==null),...reviews.filter(row=>row.unitName===null)]){
        const test=tests.find(row=>row.testRunId===review.testRunId&&row.contentReleaseId===review.contentReleaseId);
        const name=test?.originalResultState?.bookletName;if(typeof name!=='string')throw originalReviewHistoryUnavailable();
        if(!labels.has(name))labels.set(name,await input.labels(person,name));
        rows.push({groupname:binding.groupKey,loginname:binding.loginKey,code:person.originalNameSuffix,bookletname:name,unitname:review.unitName??'',
          priority:review.priority,categories:review.categories,reviewtime:formatOriginalReviewTimestamp(review.updatedAt,input.timeZone),entry:review.entry,
          page:review.page===null?null:(JSON as unknown as {rawJSON:(value:string)=>{readonly rawJSON:string}}).rawJSON(review.page),
          pagelabel:review.pageLabel,originalUnitId:review.originalUnitId,userAgent:review.userAgent,reviewer:review.reviewer});
      }
      const body=formatOriginalReviewReport({rows,format:request.format,useNewVersion:true,labels:(bookletName,unitName):OriginalReportLabels=>{
        const value=labels.get(bookletName);return{bookletlabel:value?.bookletLabel??'',unitlabel:value&&Object.hasOwn(value.unitLabels,unitName)?value.unitLabels[unitName]??'':''};
      }});
      return{status:200,body};
    }
  };
}
