import {readOriginalReviewReports} from './original-review-report.js';
import type {OriginalReportFormat} from '@testcenter-rewrite-app/contracts';
import type {FirstSliceRepository} from './index.js';
import type {OriginalAuthenticationPort} from './original-authentication.js';
import {readOriginalPerson,readOriginalTestPerson,resolveOriginalOwnedTestScope} from './original-test-access.js';
import {formatOriginalReviewListJson,requireOriginalReviewMode,originalReviewNumber,
  type OriginalReviewScope} from './original-review-record.js';
import {formatOriginalReviewReport} from './original-workspace-report-wire.js';

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
      const person=await readOriginalTestPerson(input.auth,request.token),reports=await readOriginalReviewReports(input,person);
      if(!reports.length)return{status:request.format==='csv'?204:200,body:request.format==='csv'?'':'[]'};
      const labels=new Map(reports.map(row=>[JSON.stringify([row.record.bookletname,row.record.unitname]),row.labels]));
      const body=formatOriginalReviewReport({rows:reports.map(row=>row.record),format:request.format,useNewVersion:true,
        labels:(bookletName,unitName)=>labels.get(JSON.stringify([bookletName,unitName]))??{bookletlabel:'',unitlabel:''}});
      return{status:200,body};
    }
  };
}
