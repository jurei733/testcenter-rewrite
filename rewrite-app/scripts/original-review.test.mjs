import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {prepareOriginalReviewMutation,formatOriginalReviewListJson,originalReviewNumber,OriginalReviewInteger} from '../packages/application/dist/packages/application/src/original-review-record.js';

const scope={testRunId:'run',participantSessionId:'person',tenantId:'tenant',workspaceId:'workspace',contentReleaseId:'release',unitName:'OWNED.UNIT'};
const context=()=>({previous:null,unit:null,counter:'0',person:{executionMode:'run-trial'},testNumber:'1',personNumber:'1'});
const body={entry:'Owned exact Ω\n  second line',categories:'tech design',priority:2,reviewer:'Reviewer Ä',originalUnitId:'OWNED.ORIGINAL.IDENTITY',page:3,pagelabel:'Teilaufgabe β',userAgent:'Owned Source review agent'};
const create=(s=scope,c=context(),extra={})=>prepareOriginalReviewMutation(s,c,{action:'create',reviewId:'private-uuid',body:{...body,...extra},at:'2026-10-31T18:53:23.123Z'});

for(const mode of ['run-hot-return','run-hot-restart','run-simulation','run-demo'])test(`native Review denies ${mode} without changing its counter or Unit`,()=>{
 const c=context();c.person.executionMode=mode;const before=structuredClone(c);
 assert.throws(()=>create(scope,c),error=>error.statusCode===403&&error.message===`Reviews are not available in mode \`${mode}\`.`);
 assert.deepEqual(c,before);
});
for(const mode of ['run-review','run-trial'])test(`native Review accepts the real ${mode} capability`,()=>{
 const c=context();c.person.executionMode=mode;assert.equal(create(scope,c).review.reviewNumber,'1');
});
test('native Review reserves int64 identity without Number rounding and keeps the first initialized Unit identity',()=>{
 const first=create(),c={...context(),counter:'9007199254740992',unit:first.unit};
 const next=create(scope,c,{originalUnitId:'Must never replace first',page:new OriginalReviewInteger('9007199254740993')});
 assert.equal(next.review.reviewNumber,'9007199254740993');assert.equal(next.unit.originalUnitId,body.originalUnitId);
 assert.equal(next.review.originalUnitId,body.originalUnitId);assert.equal(next.review.page,'9007199254740993');
 assert.match(formatOriginalReviewListJson([next.review]),/"id":9007199254740993/);
 assert.match(formatOriginalReviewListJson([next.review]),/"page":9007199254740993/);
 assert.equal(next.projection.page,null,'The canonical safe-number projection must never round the native page');
});
test('native Review update changes text/time and retains immutable page, browser and first Unit identity',()=>{
 const first=create(),c={...context(),previous:first.review,unit:first.unit,counter:'1'};
 const updated=prepareOriginalReviewMutation(scope,c,{action:'update',reviewNumber:'01',body:{...body,entry:'changed',reviewer:null,pagelabel:'new label',page:999,userAgent:'forged',originalUnitId:'forged'},at:'2026-10-31T18:53:24.058668Z'});
 assert.equal(updated.review.entry,'changed');assert.equal(updated.review.reviewer,null);assert.equal(updated.review.page,'3');
 assert.equal(updated.review.userAgent,body.userAgent);assert.equal(updated.review.originalUnitId,body.originalUnitId);assert.equal(updated.counter,'1');
 assert.equal(updated.review.createdAt,first.review.createdAt);assert.equal(updated.review.updatedAt,'2026-10-31T18:53:24.058668Z');
});
test('native Review validation rejects malformed bounded fields and exhaustion before publishing effects',()=>{
 for(const extra of [{entry:null},{entry:{}},{entry:'\0'},{categories:[]},{categories:'a'.repeat(51)},{reviewer:'a'.repeat(256)},
  {userAgent:'a'.repeat(513)},{page:9007199254740992},{page:'3'},{page:{value:'3'}},{page:'9223372036854775808'},{pagelabel:'a'.repeat(256)},{originalUnitId:'a'.repeat(256)}]){
  const c=context(),before=structuredClone(c);assert.throws(()=>create(scope,c,extra),error=>error.statusCode===400);assert.deepEqual(c,before);
 }
 assert.throws(()=>create(scope,{...context(),counter:'9223372036854775807'}),error=>error.statusCode===409);
 for(const number of ['0','-1','1.5','NaN','9223372036854775808'])assert.throws(()=>originalReviewNumber(number));
});
test('native Review cannot mutate a different Test/Unit or manufacture a missing review',()=>{
 const first=create();for(const changed of [{testRunId:'other'},{unitName:'OTHER'},{participantSessionId:'foreign'},{workspaceId:'other'}]){
  assert.throws(()=>prepareOriginalReviewMutation({...scope,...changed},{...context(),previous:first.review},{action:'delete',reviewNumber:'1'}));
 }
 assert.throws(()=>prepareOriginalReviewMutation(scope,context(),{action:'delete',reviewNumber:'1'}),error=>error.statusCode===404);
});
test('native Unit and Booklet list serialization matches the real Source HTTP bodies including raw field order',async()=>{
 // Actual R44 production Source47, not a second expected serializer. The
 // portable capture and verified raw oracle are retained beside the manifest.
 const fixture=JSON.parse(await readFile(new URL('../test-fixtures/original-testcenter/source-workspace-results/native-review-http/observations.json',import.meta.url),'utf8'));
 for(const kind of ['unit','booklet']){
  const s={...scope,unitName:kind==='unit'?'OWNED.UNIT':null};
  const sourceCreate=fixture.rows.find(row=>row.label===kind+'-create');
  const observed=fixture.rows.find(row=>row.label===kind+'-list');
  const value=observed.value[0],at=value.reviewtime.replace(' ','T').replace(/\+00$/,'Z');
  const created=prepareOriginalReviewMutation(s,context(),{action:'create',reviewId:'fixture',body:sourceCreate.requestBody,at});
  assert.equal(formatOriginalReviewListJson([created.review]),observed.rawText);
  const sourcePatch=fixture.rows.find(row=>row.label===kind+'-patch');
  const updated=fixture.rows.find(row=>row.label===kind+'-updated');
  const nextAt=updated.value[0].reviewtime.replace(' ','T').replace(/\+00$/,'Z');
  const next=prepareOriginalReviewMutation(s,{...context(),previous:created.review,unit:created.unit??null,counter:'1'},
   {action:'update',reviewNumber:'1',body:sourcePatch.requestBody,at:nextAt});
  assert.equal(formatOriginalReviewListJson([next.review]),updated.rawText);
 }
});
