import type {ParticipantSession,WorkspaceReview} from '@testcenter-rewrite-app/domain';
import {assertOriginalReviewScope,assertOriginalNativeReview,originalReviewScopeMatches,originalReviewHistoryUnavailable,
 originalReviewNumber,requireOriginalReviewMode,prepareOriginalReviewMutation,synchronizeOriginalReviewProjection,type OriginalReviewScope,type OriginalReviewMutation,type OriginalNativeReview} from '@testcenter-rewrite-app/application';
import {withResultArtifactParent} from './result-artifact-parent.js';
import {readOriginalNativeUnitInTransaction} from './original-native-unit.js';
import type {Pool,PoolClient} from 'pg';
type Row=Record<string,unknown>;
function decodeStored(row:Row):OriginalNativeReview{
 const review=JSON.parse(String(row.review_json)) as OriginalNativeReview;assertOriginalNativeReview(review);
 const fields={review_number:review.reviewNumber,review_id:review.reviewId,test_run_id:review.testRunId,participant_session_id:review.participantSessionId,tenant_id:review.tenantId,workspace_id:review.workspaceId,content_release_id:review.contentReleaseId};
 if(row.kind!==(review.unitName===null?'test':'unit')||Object.entries(fields).some(([key,value])=>row[key]!==value))throw originalReviewHistoryUnavailable();
 return review;
}

function driver(client:PoolClient){
 const parameters=(sql:string)=>{let n=0;return sql.replace(/\?/g,()=>'$'+(++n));};
 const all=async(sql:string,args:Array<string|number|null>):Promise<Row[]> => (await client.query(parameters(sql),args)).rows;
 const run=async(sql:string,args:Array<string|number|null>):Promise<void>=>{await client.query(parameters(sql),args);};
 return{all,run};
}
async function snapshot(client:PoolClient,scope:OriginalReviewScope,write=false){
 assertOriginalReviewScope(scope);const {all}=driver(client);
 const parents=await all(`SELECT p.execution_mode AS "executionMode",p.original_operational_mode AS "originalOperationalMode",n.test_number AS "testNumber",m.person_number AS "personNumber"
 FROM test_runs t JOIN participant_sessions p ON p.participant_session_id=t.participant_session_id AND p.tenant_id=t.tenant_id AND p.workspace_id=t.workspace_id AND p.content_release_id=t.content_release_id
 JOIN original_test_numbers n ON n.test_run_id=t.test_run_id AND n.participant_session_id=p.participant_session_id AND n.tenant_id=t.tenant_id AND n.workspace_id=t.workspace_id AND n.content_release_id=t.content_release_id
 JOIN original_person_numbers m ON m.participant_session_id=p.participant_session_id AND m.tenant_id=p.tenant_id AND m.workspace_id=p.workspace_id AND m.original_login_key=p.original_login_key AND m.original_name_suffix=p.original_name_suffix
 WHERE t.test_run_id=? AND t.participant_session_id=? AND t.tenant_id=? AND t.workspace_id=? AND t.content_release_id=?`,[scope.testRunId,scope.participantSessionId,scope.tenantId,scope.workspaceId,scope.contentReleaseId]);
 const parent=parents[0];if(!parent)throw originalReviewHistoryUnavailable();
 if(write)requireOriginalReviewMode({executionMode:typeof parent.executionMode==='string'?parent.executionMode as ParticipantSession['executionMode']:undefined,originalOperationalMode:typeof parent.originalOperationalMode==='string'?parent.originalOperationalMode as ParticipantSession['originalOperationalMode']:undefined});
 const stored=await all('SELECT * FROM original_native_reviews WHERE test_run_id=?',[scope.testRunId]);
 const complete=stored.map(row=>{return decodeStored(row);});
 for(const row of complete)if(row.testRunId!==scope.testRunId||row.participantSessionId!==scope.participantSessionId||row.tenantId!==scope.tenantId||row.workspaceId!==scope.workspaceId||row.contentReleaseId!==scope.contentReleaseId||row.testNumber!==String(parent.testNumber)||row.personNumber!==String(parent.personNumber))throw originalReviewHistoryUnavailable();
 const rows=complete.filter(row=>originalReviewScopeMatches(scope,row)),known=new Set(complete.map(row=>row.reviewId));
 const mirrors=await all('SELECT review_id,unit_key FROM workspace_reviews WHERE test_run_id=? AND participant_session_id=?',[scope.testRunId,scope.participantSessionId]);
 // Unknown legacy identities are not assigned new numbers during a read.
 if(mirrors.some(row=>!known.has(String(row.review_id))))throw originalReviewHistoryUnavailable();
 return{parent,rows:rows.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))};
}
export async function listOriginalNativeReviews(database:Pool,scope:OriginalReviewScope):Promise<OriginalNativeReview[]>{
 return await withResultArtifactParent(database,scope,async client=>{
  const data=await snapshot(client,scope);return data.rows;
 });
}
export async function mutateOriginalNativeReview(database:Pool,scope:OriginalReviewScope,operation:OriginalReviewMutation):Promise<OriginalNativeReview|null>{
 return await withResultArtifactParent(database,scope,async client=>{
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['native-unit:'+scope.testRunId]);
  const {all,run}=driver(client),data=await snapshot(client,scope,true),kind=scope.unitName===null?'test':'unit';
  const counters=await all('SELECT last_number FROM original_native_review_counters WHERE kind=? FOR UPDATE',[kind]);
  const counter=counters[0]?.last_number;if(typeof counter!=='string')throw Error('Native Review counter is missing.');
  if(operation.action==='create'){const collision=await all('SELECT review_id FROM original_native_reviews WHERE kind=? AND review_number=?',[kind,(BigInt(counter)+1n).toString()]);if(collision.length)throw Error('Native Review counter collision.');}
  if(operation.action==='create'){const collision=await all('SELECT review_id FROM workspace_reviews WHERE review_id=?',[operation.reviewId]);if(collision.length)throw Error('Native Review identity collision.');}
  const previous=operation.action==='create'?null:data.rows.find(row=>row.reviewNumber===originalReviewNumber(operation.reviewNumber))??null;
  const unit=scope.unitName===null||operation.action!=='create'?null:await readOriginalNativeUnitInTransaction(client,{...scope,unitName:scope.unitName});
  const effect=prepareOriginalReviewMutation(scope,{previous,unit,counter,person:{executionMode:typeof data.parent.executionMode==='string'?data.parent.executionMode as ParticipantSession['executionMode']:undefined,originalOperationalMode:typeof data.parent.originalOperationalMode==='string'?data.parent.originalOperationalMode as ParticipantSession['originalOperationalMode']:undefined},testNumber:String(data.parent.testNumber),personNumber:String(data.parent.personNumber)},operation);
  if(effect.unit){const u=effect.unit;await run(`INSERT INTO original_native_units(test_run_id,participant_session_id,tenant_id,workspace_id,content_release_id,unit_name,unit_json) VALUES(?,?,?,?,?,?,?)
   ON CONFLICT(test_run_id,unit_name) DO UPDATE SET unit_json=excluded.unit_json`,[u.testRunId,u.participantSessionId,u.tenantId,u.workspaceId,u.contentReleaseId,u.unitName,JSON.stringify(u)]);}
  if(effect.deletedReviewId)await run('DELETE FROM workspace_reviews WHERE review_id=?',[effect.deletedReviewId]);
  if(effect.review&&effect.projection){const r=effect.review,p=effect.projection;
   await run(`INSERT INTO workspace_reviews(review_id,tenant_id,workspace_id,participant_session_id,test_run_id,unit_key,original_unit_id,page,page_label,user_agent,reviewer_id,category,priority,comment_text,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(review_id) DO UPDATE SET reviewer_id=excluded.reviewer_id,category=excluded.category,priority=excluded.priority,comment_text=excluded.comment_text,page_label=excluded.page_label,updated_at=excluded.updated_at`,
    [p.reviewId,p.tenantId,p.workspaceId,p.participantSessionId,p.testRunId,p.unitKey,p.originalUnitId,p.page,p.pageLabel,p.userAgent,p.reviewerId,p.category,p.priority,p.comment,p.createdAt,p.updatedAt]);
   await run(`INSERT INTO original_native_reviews(kind,review_number,review_id,test_run_id,participant_session_id,tenant_id,workspace_id,content_release_id,review_json) VALUES(?,?,?,?,?,?,?,?,?)
    ON CONFLICT(kind,review_number) DO UPDATE SET review_json=excluded.review_json`,[kind,r.reviewNumber,r.reviewId,r.testRunId,r.participantSessionId,r.tenantId,r.workspaceId,r.contentReleaseId,JSON.stringify(r)]);
  }
  if(operation.action==='create')await run('UPDATE original_native_review_counters SET last_number=? WHERE kind=?',[effect.counter,kind]);
  return effect.review;
 },true);
}
export async function listOriginalNativeReviewsByPerson(database:Pool,scope:{participantSessionId:string;tenantId:string;workspaceId:string}):Promise<OriginalNativeReview[]>{
 return await withResultArtifactParent(database,scope,async client=>{
  const {all}=driver(client),stored=await all('SELECT * FROM original_native_reviews WHERE participant_session_id=? AND tenant_id=? AND workspace_id=?',[scope.participantSessionId,scope.tenantId,scope.workspaceId]);
  const rows=stored.map(row=>{const review=decodeStored(row);if(review.participantSessionId!==scope.participantSessionId||review.tenantId!==scope.tenantId||review.workspaceId!==scope.workspaceId)throw originalReviewHistoryUnavailable();return review;});
  const known=new Set(rows.map(row=>row.reviewId)),mirrors=await all('SELECT review_id FROM workspace_reviews WHERE participant_session_id=? AND tenant_id=? AND workspace_id=?',[scope.participantSessionId,scope.tenantId,scope.workspaceId]);
  if(mirrors.some(row=>!known.has(String(row.review_id))))throw originalReviewHistoryUnavailable();return rows;
 });
}
/** Caller already owns the parent transaction for a canonical edit. */
export async function synchronizeOriginalNativeReview(client:PoolClient,review:WorkspaceReview):Promise<void>{
 const {all,run}=driver(client),rows=await all('SELECT * FROM original_native_reviews WHERE review_id=?',[review.reviewId]);
 if(!rows.length)return;const row=rows[0]!,previous=decodeStored(row);
 const next=synchronizeOriginalReviewProjection(previous,review);await run('UPDATE original_native_reviews SET review_json=? WHERE kind=? AND review_number=?',[JSON.stringify(next),String(row.kind),String(row.review_number)]);
}
