import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {rename,mkdir,rm,readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {Pool,Client} from 'pg';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
import {createFirstSliceServices,decodeOriginalTestLogJson,originalUnitDelivery,prepareOriginalUnitDelivery} from '@testcenter-rewrite-app/application';
import {originalTestStateLogIdPrefix,originalTestLogIdPrefix} from '@testcenter-rewrite-app/domain';
import {handleOriginalTestHttp} from '../apps/api/dist/apps/api/src/original-test-http.js';

/** Optional delivery identity is a prerequisite for recovery. These controls do
 * not claim that an unaccepted stale Test-state packet is safe to replay. */
export async function verifyOriginalTestDeliveries(input){
 const {t,kind,file,url,auth,bookletName,reopen,repository,services,createServices}=input;
 const owner=await auth('owned-test-delivery'),token=owner.person.token;
 const testNumber=await services().originalTest.create({token,bookletName}),target={token,testNumber};
 const scope=await repository().findOriginalTestNumber({...owner.person.participantSession,testNumber});assert.ok(scope);
 const state=(content,clock=100)=>[{key:'CONTROLLER',content,timeStamp:clock},{key:'CURRENT_UNIT_ID',content:'2',timeStamp:clock}];
 const request=(extra={})=>({...target,deliveryId:randomUUID(),...extra});
 const logs=async()=> (await repository().listParticipantTestLogsByWorkspace(scope.tenantId,scope.workspaceId)).filter(row=>row.testRunId===scope.testRunId);
 const snapshot=async()=>({run:await repository().getTestRunById(scope.testRunId),person:await repository().getParticipantSessionById(scope.participantSessionId),logs:await logs()});
 const receipt=async id=>{let value;await repository().mutateParticipantRun({...scope,deliveryId:id},context=>{value=context.progressDelivery;return null;});return value??null;};
 const conflict=e=>e.statusCode===409&&e.errorCode==='original_delivery_conflict';
 let first;
 await t.test('existing R73 Unit delivery fingerprints and accepted receipts remain compatible across the shared validator change',async()=>{
  const fixture=JSON.parse(await readFile(new URL('../test-fixtures/native-delivery-r73/receipts.json',import.meta.url),'utf8'));assert.equal(fixture.producerCommit,'19ab7f2a00021c5e1a4312b6cce1be601c0d5713');assert.equal(fixture.cases.length,3);
  for(const row of fixture.cases){const {at,...args}=row.input;assert.deepEqual(originalUnitDelivery({...args,now:()=>at}),row.expected);const receipt={...args.scope,...row.expected};assert.equal(prepareOriginalUnitDelivery(args.scope,row.expected,receipt),null);}
 });
 await t.test('an acknowledged Test-state retry cannot rewind newer state or undo a native lock after reopening',async()=>{
  first=request({patch:state('RUNNING')});await services().originalTest.patchState(first);
  await services().originalTest.patchState(request({patch:state('PAUSED',200)}));
  await services().originalTest.patchLock({...target,body:{message:'Owned native lock',timeStamp:201}});
  const before=await snapshot(),accepted=await receipt('native-test-state:'+first.deliveryId);assert.ok(accepted);
  await reopen();await services().originalTest.patchState(first);assert.deepEqual(await snapshot(),before);assert.deepEqual(await receipt('native-test-state:'+first.deliveryId),accepted);
  assert.equal(before.run.locked,true);assert.equal(before.run.originalTestState.CONTROLLER,'PAUSED');
 });
 await t.test('a changed Test-state packet cannot reuse an accepted identity; unadorned packets retain Source per-request clocks',async()=>{
  const before=await snapshot();
  for(const patch of [state('FORGED'),[{key:'CONTROLLER',content:'RUNNING',timeStamp:101}]]){
   await assert.rejects(services().originalTest.patchState({...first,patch}),conflict);assert.deepEqual(await snapshot(),before);
  }
  const legacy={...target,patch:state('Legacy later request lower clock',1)};await services().originalTest.patchState(legacy);
  const once=(await logs()).length;await services().originalTest.patchState(legacy);assert.equal((await logs()).length,once+2);
  assert.equal((await snapshot()).run.originalTestState.CONTROLLER,'Legacy later request lower clock');assert.equal((await snapshot()).run.locked,true);
 });
 const raw='[{"key":"OWNED.EXACT","timeStamp":9223372036854775807,"content":{"2":1.0,"0":-0.0,"exact":9007199254740993}}]';
 await t.test('acknowledged Test logs retain native int64/float/object semantics once and leave their Run untouched',async()=>{
  const packet=request({body:decodeOriginalTestLogJson(raw)}),run=(await snapshot()).run;
  await services().originalTest.putLog(packet);const before=await snapshot();assert.deepEqual(before.run,run);
  const exact=before.logs.find(row=>row.logKey==='OWNED.EXACT');assert.equal(exact.originalClientTimestamp,'9223372036854775807');assert.ok(exact.logContent.includes('9007199254740993'));
  await reopen();await services().originalTest.putLog(packet);assert.deepEqual(await snapshot(),before);
  await assert.rejects(services().originalTest.putLog({...packet,body:[{key:'OWNED.EXACT',timeStamp:1,content:'changed'}]}),conflict);assert.deepEqual(await snapshot(),before);
  await services().originalTest.putLog({...packet,deliveryId:randomUUID()});const legacy={...target,body:decodeOriginalTestLogJson(raw)};
  await services().originalTest.putLog(legacy);await services().originalTest.putLog(legacy);
  const matching=(await logs()).filter(row=>row.logKey==='OWNED.EXACT');assert.equal(matching.length,4);assert.ok(matching.every(row=>row.logContent===exact.logContent&&row.originalClientTimestamp===exact.originalClientTimestamp));assert.deepEqual((await snapshot()).run,run);
 });
 await t.test('an empty Test log delivery has a durable immutable receipt without manufacturing log or Run state',async()=>{
  const empty=request({body:[]}),before=await snapshot();await services().originalTest.putLog(empty);assert.deepEqual(await snapshot(),before);
  const accepted=await receipt('native-test-log:'+empty.deliveryId);assert.ok(accepted);await reopen();assert.deepEqual(await receipt('native-test-log:'+empty.deliveryId),accepted);
  await services().originalTest.putLog(empty);await assert.rejects(services().originalTest.putLog({...empty,body:[{key:'new',timeStamp:1}]}),conflict);assert.deepEqual(await snapshot(),before);
 });
 await t.test('accepted Test log retries never enter the canonical Run reader or mutation path',async()=>{
  const current=repository(),guarded=new Proxy(current,{get(target,key){if(key==='getTestRunById'||key==='mutateParticipantRun')return()=>{throw Error('Test log entered a private Run decoder');};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
  const runtime=createServices(guarded),packet=request({body:[{key:'OWNED.MINIMAL',content:'metadata only',timeStamp:150}]}),before=(await snapshot()).run;
  await runtime.originalTest.putLog(packet);const after=await snapshot();await runtime.originalTest.putLog(packet);assert.deepEqual(await snapshot(),after);assert.deepEqual(after.run,before);
 });
 if(kind==='sqlite'||kind==='postgres')await t.test('native log delivery and receipt commit without reading malformed private responses or updating their Run',async()=>{
  const control=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()}),query=async(sql,args)=>kind==='sqlite'?control.prepare(sql).all(...args):(await control.query(sql,args)).rows;
  const readSql=kind==='sqlite'?'SELECT unit_responses_json FROM test_runs WHERE test_run_id=?':'SELECT unit_responses_json FROM test_runs WHERE test_run_id=$1',update=async value=>kind==='sqlite'?control.prepare('UPDATE test_runs SET unit_responses_json=? WHERE test_run_id=?').run(value,scope.testRunId):control.query('UPDATE test_runs SET unit_responses_json=$1 WHERE test_run_id=$2',[value,scope.testRunId]);
  const original=(await query(readSql,[scope.testRunId]))[0].unit_responses_json,marker='{"owned private decoder must not run":';
  const exec=sql=>kind==='sqlite'?control.exec(sql):control.query(sql),before=await snapshot();let trigger=false;
  try{
   await update(marker);await assert.rejects(repository().getTestRunById(scope.testRunId));
   await exec(kind==='sqlite'?"CREATE TRIGGER owned_log_no_run_write BEFORE UPDATE ON test_runs BEGIN SELECT RAISE(ABORT,'native Test log rewrote Run'); END":"CREATE FUNCTION owned_log_no_run_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'native Test log rewrote Run'; END $$; CREATE TRIGGER owned_log_no_run_write BEFORE UPDATE ON test_runs FOR EACH ROW EXECUTE FUNCTION owned_log_no_run_write()");trigger=true;
   const packet=request({body:[{key:'OWNED.NO.DECODE',content:'safe',timeStamp:151}]});await services().originalTest.putLog(packet);const accepted=await logs();await services().originalTest.putLog(packet);assert.deepEqual(await logs(),accepted);
   assert.equal((await query(readSql,[scope.testRunId]))[0].unit_responses_json,marker);assert.equal(accepted.length,before.logs.length+1);
  }finally{if(trigger)await exec(kind==='sqlite'?'DROP TRIGGER owned_log_no_run_write':'DROP TRIGGER owned_log_no_run_write ON test_runs; DROP FUNCTION owned_log_no_run_write()');await update(original);if(kind==='sqlite')control.close();else await control.end();}
  assert.deepEqual((await snapshot()).run,before.run);
 });
 await t.test('invalid identities and unauthenticated or foreign-owner retries cannot mutate accepted artifacts',async()=>{
  const before=await snapshot(),peer=await auth('owned-other');
  for(const deliveryId of ['',null,[],randomUUID().toUpperCase(),'native-test-log:'+randomUUID()]){
   for(const method of ['patchState','putLog'])await assert.rejects(services().originalTest[method]({...target,deliveryId,patch:state('bad'),body:[]}),e=>e.statusCode===400&&e.errorCode==='original_delivery_invalid');
  }
  await assert.rejects(services().originalTest.patchState({...first,token:peer.person.token}),e=>e.statusCode===403);
  await assert.rejects(services().originalTest.patchState({...first,token:randomUUID()}),e=>e.statusCode===401);assert.deepEqual(await snapshot(),before);
 });
 await t.test('the native HTTP boundary forwards delivery identities while preserving empty200/201 and raw log decoding',async()=>{
  const server=createServer(async(req,res)=>{
   try{await handleOriginalTestHttp({request:req,pathname:new URL(req.url,'http://localhost').pathname,services:services(),
    readBody:async(_empty,decode)=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);const bytes=Buffer.concat(chunks);return decode?decode(bytes):JSON.parse(bytes.toString());},
    header:(name,value)=>res.setHeader(name,value),reason:reason=>{res.statusMessage=reason;},raw:(status,text,type)=>{res.writeHead(status,{'content-type':type});res.end(text);},send:(status,body)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(body));},binary:()=>assert.fail('Unexpected binary response')});
   }catch{res.writeHead(500);res.end();}
  });await new Promise(done=>server.listen(0,'127.0.0.1',done));
  try{for(const [route,method,body,status] of [['state','PATCH',JSON.stringify(state('HTTP',300)),200],['log','PUT',raw,201]]){
   const options={method,body,headers:{AuthToken:token,'Content-Type':'application/json','X-Native-Delivery-Id':randomUUID()}},url='http://127.0.0.1:'+server.address().port+'/test/'+testNumber+'/'+route;
   let response=await fetch(url,options);assert.equal(response.status,status);assert.equal(await response.text(),'');const before=await snapshot();response=await fetch(url,options);assert.equal(response.status,status);assert.equal(await response.text(),'');assert.deepEqual(await snapshot(),before);
  }}finally{await new Promise(done=>server.close(done));}
 });
 for(const operation of ['state','log'])await t.test('late '+operation+' delivery commit failure leaves neither receipt nor partial artifacts',async()=>{
  const packet=request({patch:state('Owned rollback '+operation,400),body:[{key:'OWNED.ROLLBACK.'+operation,timeStamp:400,content:'retained'}]}),key='native-test-'+operation+':'+packet.deliveryId,before=await snapshot();
  const send=runtime=>operation==='state'?runtime.originalTest.patchState(packet):runtime.originalTest.putLog(packet);
  if(kind==='memory'){
   const prefix=operation==='state'?originalTestStateLogIdPrefix:originalTestLogIdPrefix;
   const existing=before.logs.find(row=>row.participantTestLogId.startsWith(prefix));assert.ok(existing);
   const failing=createFirstSliceServices({repository:repository(),idGenerator:()=>existing.participantTestLogId.slice(prefix.length)});await assert.rejects(send(failing),/identity|overwrite|collision/i);
  }else if(kind==='file'){
   const backup=file+'.test-delivery-backup';await rename(file,backup);await mkdir(file);try{await assert.rejects(send(services()));assert.deepEqual(await snapshot(),before);}finally{await rm(file,{recursive:true});await rename(backup,file);}
  }else{
   const control=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()}),exec=sql=>kind==='sqlite'?control.exec(sql):control.query(sql);
   await exec(kind==='sqlite'?"CREATE TRIGGER owned_test_delivery_failure BEFORE INSERT ON participant_progress_deliveries BEGIN SELECT RAISE(ABORT,'owned native Test delivery failure'); END":
    "CREATE FUNCTION owned_test_delivery_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned native Test delivery failure'; END $$; CREATE TRIGGER owned_test_delivery_failure BEFORE INSERT ON participant_progress_deliveries FOR EACH ROW EXECUTE FUNCTION owned_test_delivery_failure()");
   try{await assert.rejects(send(services()),/owned native Test delivery failure/);assert.deepEqual(await snapshot(),before);}finally{await exec(kind==='sqlite'?'DROP TRIGGER owned_test_delivery_failure':'DROP TRIGGER owned_test_delivery_failure ON participant_progress_deliveries; DROP FUNCTION owned_test_delivery_failure()');if(kind==='sqlite')control.close();else await control.end();}
  }
  await reopen();assert.deepEqual(await snapshot(),before);assert.equal(await receipt(key),null);await send(services());assert.ok(await receipt(key));const after=await snapshot();await send(services());assert.deepEqual(await snapshot(),after);
 });
 if(kind==='postgres')await t.test('independent PostgreSQL writers accept a concurrent Test-log or state delivery exactly once',async()=>{
  const other=await createPostgresFirstSliceStorage(url.toString());
  try{for(const operation of ['state','log']){const packet=request({patch:state('CONCURRENT',500),body:[{key:'OWNED.CONCURRENT',content:'native',timeStamp:500}]}),before=(await logs()).length;const send=runtime=>operation==='state'?runtime.originalTest.patchState(packet):runtime.originalTest.putLog(packet);
   await Promise.all([send(services()),send(createServices(other.repository))]);assert.equal((await logs()).length,before+(operation==='state'?2:1));
  }}finally{await other.shutdown();}
 });
 if(kind==='postgres')await t.test('both independent Test-log writers demonstrably wait on the durable delivery lock before one append is committed',{timeout:20000},async()=>{
  const control=new Client({connectionString:url.toString()}),other=await createPostgresFirstSliceStorage(url.toString()),packet=request({body:[{key:'OWNED.OBSERVED.WAIT',content:'one append',timeStamp:600}]}),key='native-test-delivery:'+scope.testRunId,before=(await logs()).length;let writing,held=false,finished=false;
  await control.connect();
  try{
   await control.query('SELECT pg_advisory_lock(hashtextextended($1,0))',[key]);held=true;
   writing=Promise.all([services().originalTest.putLog(packet),createServices(other.repository).originalTest.putLog(packet)]).then(()=>{finished=true;});void writing.catch(()=>{});
   const end=Date.now()+10000;let observed=0;
   while(Date.now()<end){const rows=await control.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE 'SELECT pg_advisory_xact_lock%'",[url.searchParams.get('application_name')]);observed=rows.rows[0].n;if(observed===2)break;assert.equal(finished,false);await new Promise(done=>setTimeout(done,10));}
   assert.equal(observed,2,'Both real PostgreSQL connections must reach the delivery wait');assert.equal(finished,false);assert.equal((await logs()).length,before);
   await control.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[key]);held=false;await writing;
   assert.equal((await logs()).length,before+1);assert.ok(await receipt('native-test-log:'+packet.deliveryId));
  }finally{if(held)await control.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[key]);if(writing)await writing.catch(()=>{});await other.shutdown();await control.end();}
 });
 await t.test('Run deletion removes Test delivery receipts and a replay cannot restore the removed native mapping',async()=>{
  const before=await snapshot();assert.ok(await receipt('native-test-state:'+first.deliveryId));assert.equal(await repository().deleteTestRunsByIds([scope.testRunId]),1);
  await assert.rejects(services().originalTest.patchState(first));assert.equal(await repository().getTestRunById(scope.testRunId),null);await repository().saveTestRun(before.run);assert.equal(await receipt('native-test-state:'+first.deliveryId),null);
 });
}
