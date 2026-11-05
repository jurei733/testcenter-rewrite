import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {rename,mkdir,rm} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {Pool} from 'pg';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {handleOriginalTestHttp} from '../apps/api/dist/apps/api/src/original-test-http.js';

// These controls share the real native login/content fixture and execute through
// its service and durable repository. No receipt or Unit is fabricated by a test.
export async function verifyOriginalUnitDeliveries(input){
 const {t,kind,file,url,repository,services,auth,bookletName,reopen,createServices}=input;
 const owner=await auth('owned-unit-delivery'),token=owner.person.token;
 const testNumber=await services().originalTest.create({token,bookletName});
 const scope=await repository().findOriginalTestNumber({...owner.person.participantSession,testNumber});assert.ok(scope);
 const unitName='OWNED.DELIVERY.UNIT',target={token,testNumber,unitName};
 const state=(content='first',timeStamp=100)=>({originalUnitId:'OWNED.ORIGINAL.DELIVERY',newState:[{key:'OWNED.DELIVERY',content,timeStamp}]});
 const response=(content='Exact answer Ω\n  ',timeStamp=100)=>({timeStamp,dataParts:{answer:content},responseType:'owned/native'});
 const request=(body,extra={})=>({...target,deliveryId:randomUUID(),body,...extra});
 const logs=async()=> (await repository().listParticipantTestLogsByWorkspace(scope.tenantId,scope.workspaceId)).filter(row=>row.testRunId===scope.testRunId);
 const unit=()=>repository().getOriginalUnit({...scope,unitName});
 const receipt=async deliveryId=>{
  let row;await repository().mutateParticipantRun({...scope,deliveryId},context=>{row=context.progressDelivery;return null;});return row??null;
 };
 const snapshot=async()=>({unit:await unit(),logs:await logs(),run:await repository().getTestRunById(scope.testRunId)});
 const conflict=error=>error.statusCode===409&&error.errorCode==='original_delivery_conflict';
 let first;
 await t.test('native acknowledged state retries preserve clocks, logs and newer edits after reopening',async()=>{
  first=request(state());await services().originalUnit.patchState(first);
  await services().originalUnit.patchState(request(state('newer',200)));
  const before=await snapshot(),savedReceipt=await receipt('native-unit-state:'+first.deliveryId);assert.ok(savedReceipt);
  await reopen();await services().originalUnit.patchState(first);
  assert.deepEqual(await snapshot(),before);assert.deepEqual(await receipt('native-unit-state:'+first.deliveryId),savedReceipt);
  assert.equal((await unit()).state['OWNED.DELIVERY'],'newer');assert.equal((await logs()).length,2);
 });
 await t.test('a lost answer acknowledgement cannot roll back a newer response or freeze another field',async()=>{
  const old=request(response());await services().originalUnit.putResponse(old);
  await services().originalUnit.putResponse(request(response('Newest answer Ω',200)));
  const before=await snapshot();await reopen();await services().originalUnit.putResponse(old);assert.deepEqual(await snapshot(),before);
  assert.equal((await unit()).parts.find(row=>row.id==='answer').content,'Newest answer Ω');
  await services().originalUnit.putResponse(request({timeStamp:150,dataParts:{other:'Earlier independent field'},responseType:'owned/other'}));
  assert.equal((await unit()).parts.find(row=>row.id==='other').content,'Earlier independent field');
 });
 await t.test('native log retries append once while distinct identities and unadorned Source requests still append',async()=>{
  const packet=request({logEntries:[{key:'OWNED.LOG',content:{exact:'Ω\n'},timeStamp:0}]});
  await services().originalUnit.putLog(packet);const before=await snapshot();await reopen();await services().originalUnit.putLog(packet);assert.deepEqual(await snapshot(),before);
  await services().originalUnit.putLog({...packet,deliveryId:randomUUID()});
  const legacy={...packet};delete legacy.deliveryId;
  await services().originalUnit.putLog(legacy);await services().originalUnit.putLog(legacy);
  assert.equal((await logs()).filter(row=>row.logKey==='OWNED.LOG').length,4);
  for(const row of (await logs()).filter(row=>row.logKey==='OWNED.LOG')){
   assert.equal(row.timestamp,0);assert.equal(row.originalTimestamp,0);assert.deepEqual(JSON.parse(row.logContent),{exact:'Ω\n'});
  }
  const repeatedState={...target,body:state('legacy',300)};await services().originalUnit.patchState(repeatedState);await services().originalUnit.patchState(repeatedState);
  assert.equal((await logs()).filter(row=>row.logKey==='OWNED.DELIVERY').length,4);
 });
 await t.test('accepted identity cannot change payload, original Unit ID or alias; failed validation never reserves it',async()=>{
  const before=await snapshot();
  for(const patch of [{body:state('changed')},{body:{...first.body,originalUnitId:'forged'}},{unitName:'OWNED.OTHER.ALIAS'}]){
   await assert.rejects(services().originalUnit.patchState({...first,...patch}),conflict);assert.deepEqual(await snapshot(),before);
  }
  const invalid=request({newState:[{key:'invalid',content:null,timeStamp:1}]});
  await assert.rejects(services().originalUnit.patchState(invalid));assert.equal(await receipt('native-unit-state:'+invalid.deliveryId),null);
  await services().originalUnit.patchState({...invalid,body:state('valid after failure',400)});
 });
 await t.test('invalid delivery headers cannot mutate data or create a receipt',async()=>{
  const before=await snapshot();
  for(const deliveryId of ['',null,[],[randomUUID()],randomUUID().toUpperCase(),'native-unit-state:'+randomUUID(),'../'+randomUUID()]){
   await assert.rejects(services().originalUnit.patchState({...first,deliveryId}),e=>e.statusCode===400&&e.errorCode==='original_delivery_invalid');
   assert.deepEqual(await snapshot(),before);
  }
 });
 await t.test('receipt replay still requires the current authenticated owner and never trusts its delivery ID',async()=>{
  const peer=await auth('owned-other'),before=await snapshot();
  await assert.rejects(services().originalUnit.patchState({...first,token:peer.person.token}),e=>e.statusCode===403);
  await assert.rejects(services().originalUnit.patchState({...first,token:randomUUID()}),e=>e.statusCode===401);
  assert.deepEqual(await snapshot(),before);
 });
 await t.test('the real HTTP route carries optional delivery headers and keeps native status and empty response bytes',async()=>{
  const server=createServer(async(req,res)=>{
   try{
    const handled=await handleOriginalTestHttp({request:req,pathname:new URL(req.url,'http://localhost').pathname,services:services(),
     readBody:async()=>{const bytes=[];for await(const chunk of req)bytes.push(chunk);return JSON.parse(Buffer.concat(bytes).toString());},
     header:(name,value)=>res.setHeader(name,value),reason:text=>{res.statusMessage=text;},
     raw:(status,text,type)=>{res.writeHead(status,{'content-type':type});res.end(text);},
     send:(status,value)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));},binary:()=>assert.fail('Unexpected resource')});
    if(!handled){res.writeHead(404);res.end();}
   }catch{res.writeHead(500);res.end();}
  });
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  try{
   const base='http://127.0.0.1:'+server.address().port+'/test/'+testNumber+'/unit/'+unitName;
   for(const [kind,method,body,status] of [['state','PATCH',state('HTTP',500),200],['response','PUT',response('HTTP answer',500),201],['log','PUT',{logEntries:[{key:'OWNED.HTTP.LOG',content:'wire',timeStamp:500}]},201]]){
    const deliveryId=randomUUID(),options={method,headers:{authtoken:token,'content-type':'application/json','x-native-delivery-id':deliveryId},body:JSON.stringify(body)};
    let reply=await fetch(base+'/'+kind,options);assert.equal(reply.status,status);assert.equal(await reply.text(),'');const before=await snapshot();
    reply=await fetch(base+'/'+kind,options);assert.equal(reply.status,status);assert.equal(await reply.text(),'');assert.deepEqual(await snapshot(),before);
    reply=await fetch(base+'/'+kind,{...options,body:JSON.stringify({...body,changed:true})});assert.equal(reply.status,409);await reply.text();assert.deepEqual(await snapshot(),before);
   }
  }finally{await new Promise(done=>server.close(done));}
 });
 await t.test('late durable failure rolls back the receipt, state and appended logs together',async()=>{
  const packet=request(state('retry after failed commit',600)),before=await snapshot(),key='native-unit-state:'+packet.deliveryId;
  if(kind==='memory'){
   const existing=(await logs())[0],failing=createFirstSliceServices({repository:repository(),idGenerator:()=>existing.participantTestLogId.replace(/^original-unit-log:/,'')});
   await assert.rejects(failing.originalUnit.patchState(packet),/collision/i);
  }else if(kind==='file'){
   const backup=file+'.delivery-backup';await rename(file,backup);await mkdir(file);
   try{await assert.rejects(services().originalUnit.patchState(packet));assert.deepEqual(await snapshot(),before);}
   finally{await rm(file,{recursive:true});await rename(backup,file);}
  }else{
   const control=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()}),exec=sql=>kind==='sqlite'?control.exec(sql):control.query(sql);
   await exec(kind==='sqlite'?"CREATE TRIGGER owned_delivery_failure BEFORE INSERT ON participant_progress_deliveries BEGIN SELECT RAISE(ABORT,'owned native delivery commit failure'); END":
    "CREATE FUNCTION owned_delivery_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned native delivery commit failure'; END $$; CREATE TRIGGER owned_delivery_failure BEFORE INSERT ON participant_progress_deliveries FOR EACH ROW EXECUTE FUNCTION owned_delivery_failure()");
   try{await assert.rejects(services().originalUnit.patchState(packet),/owned native delivery commit failure/);assert.deepEqual(await snapshot(),before);}
   finally{await exec(kind==='sqlite'?'DROP TRIGGER owned_delivery_failure':'DROP TRIGGER owned_delivery_failure ON participant_progress_deliveries; DROP FUNCTION owned_delivery_failure()');if(kind==='sqlite')control.close();else await control.end();}
  }
  await reopen();assert.deepEqual(await snapshot(),before);assert.equal(await receipt(key),null);
  await services().originalUnit.patchState(packet);assert.ok(await receipt(key));
  const after=await snapshot();await services().originalUnit.patchState(packet);assert.deepEqual(await snapshot(),after);
 });
 if(kind==='postgres')await t.test('independent PostgreSQL writers acknowledge one durable state/log transaction for concurrent retries',async()=>{
  const other=await createPostgresFirstSliceStorage(url.toString()),packet=request(state('Concurrent acknowledged state',700)),before=(await logs()).length;
  try{await Promise.all([services().originalUnit.patchState(packet),createServices(other.repository).originalUnit.patchState(packet)]);
   assert.equal((await logs()).length,before+1);assert.equal((await unit()).state['OWNED.DELIVERY'],'Concurrent acknowledged state');
  }finally{await other.shutdown();}
 });
 await t.test('deleting an owned Run retires its receipts and old retries cannot recreate it',async()=>{
  const saved=await repository().getTestRunById(scope.testRunId);assert.ok(await receipt('native-unit-state:'+first.deliveryId));
  assert.equal(await repository().deleteTestRunsByIds([scope.testRunId]),1);
  await assert.rejects(services().originalUnit.patchState(first));assert.equal(await repository().getTestRunById(scope.testRunId),null);
  // Private restoration exposes orphan receipts that normal requests cannot read.
  await repository().saveTestRun(saved);assert.equal(await receipt('native-unit-state:'+first.deliveryId),null);assert.equal(await unit(),null);
 });
}
