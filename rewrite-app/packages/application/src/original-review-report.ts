import type {ParticipantSession} from '@testcenter-rewrite-app/domain';
import type {FirstSliceRepository} from './index.js';
import {originalReviewHistoryUnavailable} from './original-review-record.js';
import {formatOriginalReviewTimestamp,type OriginalReviewReportRecord,type OriginalReportLabels} from './original-workspace-report-wire.js';

export type OriginalReviewReportProjection={reviewId:string;record:OriginalReviewReportRecord;labels:OriginalReportLabels};
export type OriginalReviewReportReader={repository:FirstSliceRepository;timeZone:string;
 labels:(scope:{tenantId:string;workspaceId:string},bookletName:string)=>Promise<{bookletLabel:string;unitLabels:Record<string,string>}>};

/** Shared native report data for participant exports and the operator archive.
 * Safe canonical mirrors cannot recover raw nullable fields or numeric pages. */
export async function readOriginalReviewReports(input:OriginalReviewReportReader,person:ParticipantSession):Promise<OriginalReviewReportProjection[]>{
  const reviews=await input.repository.listOriginalReviewsByPerson(person);
  if(!reviews.length)return [];
  const [bindings,tests]=await Promise.all([input.repository.listOriginalLoginBindingsByWorkspace(person.tenantId,person.workspaceId),input.repository.listOriginalPersonTestIdentities(person)]);
  const binding=bindings.find(row=>row.loginKey===person.originalLoginKey);
  if(!binding||person.originalNameSuffix===undefined)throw originalReviewHistoryUnavailable();
  const verified=new Map<string,Map<string,import('./original-review-record.js').OriginalNativeReview>>();
  const labels=new Map<string,{bookletLabel:string;unitLabels:Record<string,string>}>(),rows:OriginalReviewReportProjection[]=[];
  // Source ReviewDAO concatenates the Unit rows followed by Booklet rows.
  for(const observed of [...reviews.filter(row=>row.unitName!==null),...reviews.filter(row=>row.unitName===null)]){
    const key=JSON.stringify([observed.testRunId,observed.unitName]);
    if(!verified.has(key))verified.set(key,new Map((await input.repository.listOriginalReviews(observed)).map(row=>[row.reviewId,row])));
    const review=verified.get(key)!.get(observed.reviewId);if(!review)throw originalReviewHistoryUnavailable();
    const test=tests.find(row=>row.testRunId===review.testRunId&&row.contentReleaseId===review.contentReleaseId);
    const name=test?.originalResultState?.bookletName;if(typeof name!=='string')throw originalReviewHistoryUnavailable();
    if(!labels.has(name))labels.set(name,await input.labels(person,name));
    rows.push({reviewId:review.reviewId,record:{groupname:binding.groupKey,loginname:binding.loginKey,code:person.originalNameSuffix,bookletname:name,unitname:review.unitName??'',
      priority:review.priority,categories:review.categories,reviewtime:formatOriginalReviewTimestamp(review.updatedAt,input.timeZone),entry:review.entry,
      page:review.page===null?null:(JSON as unknown as {rawJSON:(value:string)=>{readonly rawJSON:string}}).rawJSON(review.page),
      pagelabel:review.pageLabel,originalUnitId:review.originalUnitId,userAgent:review.userAgent,reviewer:review.reviewer},labels:{bookletlabel:labels.get(name)!.bookletLabel,unitlabel:review.unitName!==null&&Object.hasOwn(labels.get(name)!.unitLabels,review.unitName)?labels.get(name)!.unitLabels[review.unitName]??'':''}});
  }
  return rows;
}
