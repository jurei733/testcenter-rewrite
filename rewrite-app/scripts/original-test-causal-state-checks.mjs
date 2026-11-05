import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {mkdir,rename,rm} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {Pool} from 'pg';
import {createFirstSliceServices,formatOriginalTestReadJson} from '@testcenter-rewrite-app/application';
import {handleOriginalTestHttp} from '../apps/api/dist/apps/api/src/original-test-http.js';

/** Real service/store controls. No client wall-clock ordering or sleeps. */
export async function verifyOriginalTestCausalState({t,kind,file,url,auth,bookletName,reopen,repository,services}) {
 const owner=await auth('owned-test-delivery'),token=owner.person.token;
 let sequence=0;
 const fresh=async()=>{
  const testNumber=await services().originalTest.create({token,bookletName:bookletName+'#causal:'+ ++sequence}),target={token,testNumber};
  const read=await services().originalTest.read({...target,nativeStateProtocol:'1'}),base=read.nativeStateBase;
  assert.deepEqual(base,{version:1,revision:0,controlEpoch:0});
  const scope=await repository().findOriginalTestNumber({...owner.person.participantSession,testNumber});assert.ok(scope);
  const run=()=>repository().getTestRunById(scope.testRunId);
  const logs=async()=>(await repository().listParticipantTestLogsByWorkspace(scope.tenantId,scope.workspaceId)).filter(row=>row.testRunId===scope.testRunId);
  const write=(patch,stateBase=base,deliveryId=randomUUID())=>services().originalTest.patchState({...target,patch,stateBase,deliveryId});
  return {target,base,scope,run,logs,write};
 };
 const entry=(key,content,timeStamp=1)=>({key,content,timeStamp});
 await t.test('protocol initialization on an already opened Test changes neither Source bytes nor firstStart or Test timestamps',async()=>{
  const testNumber=await services().originalTest.create({token,bookletName:bookletName+'#causal:initialize'}),target={token,testNumber};
  await services().originalTest.read(target);
  const scope=await repository().findOriginalTestNumber({...owner.person.participantSession,testNumber});
  const before=await repository().getTestRunById(scope.testRunId),legacy=await services().originalTest.read(target);
  assert.equal(legacy.nativeStateBase,undefined);
  const initialized=await services().originalTest.read({...target,nativeStateProtocol:'1'});
  assert.equal(initialized.firstStart,false);assert.equal(formatOriginalTestReadJson(initialized),formatOriginalTestReadJson(legacy));
  const after=await repository().getTestRunById(scope.testRunId),guard=after.originalResultState.nativeWriteGuard;
  assert.deepEqual(guard,{version:1,revision:0,controlEpoch:0,fields:{}});
  const withoutGuard=structuredClone(after);delete withoutGuard.originalResultState.nativeWriteGuard;assert.equal(after.stateRevision,before.stateRevision+1);withoutGuard.stateRevision=before.stateRevision;assert.deepEqual(withoutGuard,before);
  await reopen();assert.deepEqual((await services().originalTest.read({...target,nativeStateProtocol:'1'})).nativeStateBase,initialized.nativeStateBase);
 });
 await t.test('unaccepted old control cannot overwrite a peer; independent shared parameters and complete state-log history survive',async()=>{
  const x=await fresh();await x.write([entry('CONTROLLER','PAUSED',200),entry('CURRENT_UNIT_ID','new',200)]);
  const before=await x.run();
  const result=await x.write([entry('CONTROLLER','RUNNING',999999),entry('CURRENT_UNIT_ID','old',999999),entry('SHARED_PARAMETERS','independent',1)]);
  assert.deepEqual(result.appliedKeys,['SHARED_PARAMETERS']);assert.deepEqual(result.supersededKeys,['CONTROLLER','CURRENT_UNIT_ID']);
  const after=await x.run();assert.equal(after.originalTestState.CONTROLLER,'PAUSED');assert.equal(after.originalTestState.CURRENT_UNIT_ID,'new');assert.equal(after.originalTestState.SHARED_PARAMETERS,'independent');
  assert.equal(after.originalResultState.nativeWriteGuard.controlEpoch,before.originalResultState.nativeWriteGuard.controlEpoch);
  assert.equal((await x.logs()).length,5);
 });
 await t.test('an acknowledged command context authorizes future entries without rebasing earlier entries in the same Source packet',async()=>{
  const x=await fresh();await repository().lockOriginalTest(x.scope,'2026-11-05T02:00:00.000Z');
  const before=await x.run(),guard=before.originalResultState.nativeWriteGuard;
  const base={...x.base,segments:[{start:2,revision:guard.revision,controlEpoch:guard.controlEpoch}]};
  const patch=[entry('CURRENT_UNIT_ID','old before lock'),entry('CONTROLLER','RUNNING'),entry('CONTROLLER','TERMINATED',2)];
  const result=await x.write(patch,base);assert.deepEqual(result.appliedKeys,['CONTROLLER']);assert.deepEqual(result.supersededKeys,['CURRENT_UNIT_ID']);assert.equal(result.currentSuperseded,false);
  const after=await x.run();assert.equal(after.locked,true);assert.equal(after.originalTestState.CURRENT_UNIT_ID,undefined);assert.equal(after.originalTestState.CONTROLLER,'TERMINATED');assert.equal((await x.logs()).length,3);
  const current={...x.base,segments:[{start:1,revision:guard.revision,controlEpoch:guard.controlEpoch}]};
  await repository().lockOriginalTest(x.scope,'2026-11-05T02:00:01.000Z');
  const rejected=await x.write([entry('FOCUS','HAS'),entry('CONTROLLER','RUNNING')],current);assert.equal(rejected.currentSuperseded,true);assert.equal((await x.run()).originalTestState.CONTROLLER,'TERMINATED');
 });
 await t.test('native repeated locks and lock/unlock ABA invalidate old navigation while unrelated data remains writable',async()=>{
  const x=await fresh();const at='2026-11-05T00:00:00.000Z';
  await repository().lockOriginalTest(x.scope,at);await repository().lockOriginalTest(x.scope,at);
  assert.equal((await x.run()).originalResultState.nativeWriteGuard.controlEpoch,2);
  await repository().mutateParticipantRun(x.scope,context=>({testRun:{...context.testRun,locked:false,updatedAt:at},testLogs:[],activityEvents:[]}));
  assert.equal((await x.run()).locked,false);assert.equal((await x.run()).originalResultState.nativeWriteGuard.controlEpoch,3);
  const result=await x.write([entry('CURRENT_UNIT_ID','stale'),entry('SHARED_PARAMETERS','retained')]);
  assert.deepEqual(result.supersededKeys,['CURRENT_UNIT_ID']);assert.equal((await x.run()).originalTestState.CURRENT_UNIT_ID,undefined);assert.equal((await x.run()).originalTestState.SHARED_PARAMETERS,'retained');
 });
 await t.test('Source connection polling updates its evidence without inventing a lock or invalidating a causal control base',async()=>{
  const x=await fresh();await x.write([entry('CONNECTION','LOST')]);const before=await x.run();
  assert.equal(await repository().touchOriginalCommandPolling(x.scope,'2026-11-05T03:00:00.000Z'),true);
  const after=await x.run();assert.deepEqual(after.originalResultState.nativeWriteGuard,before.originalResultState.nativeWriteGuard);assert.equal(after.locked,before.locked);
 });
 await t.test('a successful predecessor allows its next control packet without blessing a foreign field changed in between',async()=>{
  const x=await fresh(),id=randomUUID();await x.write([entry('CURRENT_UNIT_ID','first')],x.base,id);
  await x.write([entry('SHARED_PARAMETERS','peer')]);
  const secondId=randomUUID(),base={...x.base,previousDeliveryId:id};
  const result=await x.write([entry('CURRENT_UNIT_ID','second'),entry('SHARED_PARAMETERS','stale')],base,secondId);
  assert.deepEqual(result.appliedKeys,['CURRENT_UNIT_ID']);assert.deepEqual(result.supersededKeys,['SHARED_PARAMETERS']);
  const third=await x.write([entry('CURRENT_UNIT_ID','third'),entry('SHARED_PARAMETERS','still stale')],{...x.base,previousDeliveryId:secondId});
  assert.deepEqual(third.appliedKeys,['CURRENT_UNIT_ID']);assert.deepEqual(third.supersededKeys,['SHARED_PARAMETERS']);
  const run=await x.run();assert.equal(run.originalTestState.CURRENT_UNIT_ID,'third');assert.equal(run.originalTestState.SHARED_PARAMETERS,'peer');
 });
 await t.test('a superseded predecessor and independent focus packet cannot launder a foreign control epoch into descendants',async()=>{
  const x=await fresh();await x.write([entry('CONTROLLER','PAUSED')]);
  const firstId=randomUUID(),first=await x.write([entry('CONTROLLER','RUNNING'),entry('FOCUS','HAS')],x.base,firstId);
  assert.deepEqual(first.appliedKeys,['FOCUS']);assert.deepEqual(first.supersededKeys,['CONTROLLER']);
  const next=await x.write([entry('CONTROLLER','RUNNING'),entry('FOCUS','LOST')],{...x.base,previousDeliveryId:firstId});
  assert.deepEqual(next.appliedKeys,['FOCUS']);assert.deepEqual(next.supersededKeys,['CONTROLLER']);assert.equal((await x.run()).originalTestState.CONTROLLER,'PAUSED');
 });
 await t.test('missing predecessor waits with425 and no effects; exact accepted outcome survives reopening and later locks',async()=>{
  const x=await fresh(),previous=randomUUID(),id=randomUUID(),base={...x.base,previousDeliveryId:previous},patch=[entry('CURRENT_UNIT_ID','second')];
  const before=await x.run();await assert.rejects(x.write(patch,base,id),error=>error.statusCode===425);assert.deepEqual(await x.run(),before);assert.deepEqual(await x.logs(),[]);
  await x.write([entry('CURRENT_UNIT_ID','first')],x.base,previous);const accepted=await x.write(patch,base,id);
  await repository().lockOriginalTest(x.scope,'2026-11-05T01:00:00.000Z');const after=await x.run(),logs=await x.logs();await reopen();
  assert.deepEqual(await x.write(patch,base,id),accepted);assert.deepEqual(await x.run(),after);assert.deepEqual(await x.logs(),logs);
  await assert.rejects(x.write(patch,{...base,revision:1},id),error=>error.statusCode===409);
 });
 await t.test('all-superseded and nonpositive entries append history once without changing Run state or Test timestamps',async()=>{
  const x=await fresh();await x.write([entry('CONTROLLER','PAUSED')]);const before=await x.run();
  const id=randomUUID(),patch=[entry('CONTROLLER','RUNNING'),entry('FOCUS','zero',0),entry('CONNECTION','negative',-1)];
  const result=await x.write(patch,x.base,id);assert.deepEqual(result.appliedKeys,[]);assert.deepEqual(result.supersededKeys,['CONTROLLER']);
  assert.deepEqual(await x.run(),before);const logs=await x.logs();assert.equal(logs.length,4);
  await x.write(patch,x.base,id);assert.deepEqual(await x.logs(),logs);
 });
 await t.test('concurrent same-base writers retain both histories and accept only one conflicting state even after reopening',async()=>{
  const x=await fresh(),results=await Promise.all([x.write([entry('CURRENT_UNIT_ID','A')]),x.write([entry('CURRENT_UNIT_ID','B')])]);
  assert.equal(results.filter(result=>result.appliedKeys.length===1).length,1);assert.equal(results.filter(result=>result.supersededKeys.length===1).length,1);
  const before=await x.run();assert.ok(['A','B'].includes(before.originalTestState.CURRENT_UNIT_ID));assert.equal((await x.logs()).length,2);
  await reopen();assert.deepEqual(await x.run(),before);
 });
 await t.test('prototype-looking keys are ordinary own fields; legacy no-header Source per-packet clocks still work after opt-in',async()=>{
  const x=await fresh();await x.write([entry('__proto__','owned'),entry('constructor','owned')]);
  const run=await x.run();assert.equal(Object.hasOwn(run.originalResultState.nativeWriteGuard.fields,'__proto__'),true);assert.equal(run.originalTestState.__proto__,'owned');
  await services().originalTest.patchState({...x.target,patch:[entry('CONTROLLER','PAUSED',900)]});
  await services().originalTest.patchState({...x.target,patch:[entry('CONTROLLER','RUNNING',1)]});assert.equal((await x.run()).originalTestState.CONTROLLER,'RUNNING');
  const result=await x.write([entry('CONTROLLER','stale',1000)]);assert.deepEqual(result.supersededKeys,['CONTROLLER']);
 });
 await t.test('malformed and future bases, absent identities and a foreign predecessor leave every artifact unchanged',async()=>{
  const x=await fresh(),other=await fresh(),foreignId=randomUUID();await other.write([entry('CURRENT_UNIT_ID','other')],other.base,foreignId);
  const before=await x.run(),patch=[entry('CURRENT_UNIT_ID','invalid')];
  for(const stateBase of [null,'broken',[],{...x.base,revision:-1},{...x.base,revision:1},{...x.base,controlEpoch:1},{...x.base,extra:true},{...x.base,previousDeliveryId:'invalid'}])await assert.rejects(x.write(patch,stateBase),error=>error.statusCode===400);
  await assert.rejects(services().originalTest.patchState({...x.target,patch,stateBase:x.base}),error=>error.statusCode===400);
  const id=randomUUID();await assert.rejects(x.write(patch,{...x.base,previousDeliveryId:id},id),error=>error.statusCode===400);
  await assert.rejects(x.write(patch,{...x.base,previousDeliveryId:foreignId}),error=>error.statusCode===425);
  assert.deepEqual(await x.run(),before);assert.deepEqual(await x.logs(),[]);
 });
 await t.test('a late all-superseded state commit failure rolls back causal receipt and logs without changing the guard',async()=>{
  const x=await fresh();await x.write([entry('CONTROLLER','PAUSED')]);const before={run:await x.run(),logs:await x.logs()},deliveryId=randomUUID(),packet={...x.target,stateBase:x.base,deliveryId,patch:[entry('CONTROLLER','stale')]};
  if(kind==='memory'){
   const prefix='original-test-state:',existing=before.logs[0];assert.ok(existing.participantTestLogId.startsWith(prefix));
   const failing=createFirstSliceServices({repository:repository(),idGenerator:()=>existing.participantTestLogId.slice(prefix.length)});
   await assert.rejects(failing.originalTest.patchState(packet),/identity|collision/i);
  }else if(kind==='file'){
   const backup=file+'.causal-backup';await rename(file,backup);await mkdir(file);
   try{await assert.rejects(services().originalTest.patchState(packet));}finally{await rm(file,{recursive:true});await rename(backup,file);}
  }else{
   const control=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()}),exec=sql=>kind==='sqlite'?control.exec(sql):control.query(sql);
   await exec(kind==='sqlite'?"CREATE TRIGGER owned_causal_failure BEFORE INSERT ON participant_progress_deliveries BEGIN SELECT RAISE(ABORT,'owned causal commit failure'); END":"CREATE FUNCTION owned_causal_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned causal commit failure'; END $$; CREATE TRIGGER owned_causal_failure BEFORE INSERT ON participant_progress_deliveries FOR EACH ROW EXECUTE FUNCTION owned_causal_failure()");
   try{await assert.rejects(services().originalTest.patchState(packet),/owned causal commit failure/);}finally{await exec(kind==='sqlite'?'DROP TRIGGER owned_causal_failure':'DROP TRIGGER owned_causal_failure ON participant_progress_deliveries; DROP FUNCTION owned_causal_failure()');if(kind==='sqlite')control.close();else await control.end();}
  }
  assert.deepEqual(await x.run(),before.run);assert.deepEqual(await x.logs(),before.logs);
  let receipt;await repository().mutateParticipantRun({...x.scope,deliveryId:'native-test-state:'+deliveryId},context=>{receipt=context.progressDelivery;return null;});assert.equal(receipt,null);
  const result=await services().originalTest.patchState(packet);assert.deepEqual(result.supersededKeys,['CONTROLLER']);assert.equal((await x.logs()).length,before.logs.length+1);
 });
 await t.test('native HTTP protocol keeps original bodies and returns compact causal evidence rather than an unbounded field map',async()=>{
  const x=await fresh(),server=createServer(async(req,res)=>{
   try{await handleOriginalTestHttp({request:req,pathname:new URL(req.url,'http://localhost').pathname,services:services(),
    readBody:async()=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);return JSON.parse(Buffer.concat(chunks).toString());},
    header:(name,value)=>res.setHeader(name,value),reason:reason=>{res.statusMessage=reason;},raw:(status,text,type)=>{res.writeHead(status,{'content-type':type});res.end(text);},send:(status,body)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(body));},binary:()=>assert.fail('Unexpected binary')});
   }catch{res.writeHead(500);res.end();}
  });await new Promise(done=>server.listen(0,'127.0.0.1',done));
  try{const url='http://127.0.0.1:'+server.address().port+'/test/'+x.target.testNumber;
   const legacy=await fetch(url,{headers:{AuthToken:token}}),wire=await legacy.text();assert.equal(legacy.headers.get('x-native-state-base'),null);
   const read=await fetch(url,{headers:{AuthToken:token,'X-Native-State-Protocol':'1'}});assert.equal(await read.text(),wire);assert.deepEqual(JSON.parse(read.headers.get('x-native-state-base')),x.base);
   const body=JSON.stringify(Array.from({length:300},(_,index)=>entry('field'+index,'value'))),id=randomUUID();
   const options={method:'PATCH',body,headers:{AuthToken:token,'Content-Type':'application/json','X-Native-Delivery-Id':id,'X-Native-State-Base':JSON.stringify(x.base)}};
   const response=await fetch(url+'/state',options);assert.equal(response.status,200);assert.equal(await response.text(),'');const header=response.headers.get('x-native-state-result');assert.ok(header.length<200);assert.deepEqual(JSON.parse(header),{version:1,revision:1,controlEpoch:0,superseded:false});
   const retry=await fetch(url+'/state',options);assert.equal(retry.headers.get('x-native-state-result'),header);assert.equal(await retry.text(),'');
  }finally{await new Promise(done=>server.close(done));}
 });
}
