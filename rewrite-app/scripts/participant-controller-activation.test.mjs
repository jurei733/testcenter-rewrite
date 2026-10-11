import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,mkdir,rename,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {Worker} from 'node:worker_threads';
import {setTimeout as delay} from 'node:timers/promises';
import test from 'node:test';
import {Pool} from 'pg';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceRepository} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceRepository} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';

const timestamp='2026-10-11T00:00:00.000Z';
const kinds=['memory','file','sqlite'];
if(process.env.FIRST_SLICE_STORE==='postgres') {assert.ok(process.env.FIRST_SLICE_POSTGRES_URL);kinds.push('postgres');}
for(const kind of kinds) test(`${kind}: activate a controller against its current parent and Run`,async t=>{
 const directory=await mkdtemp(join(tmpdir(),'testcenter-controller-activation-'));
 const file=join(directory,kind==='sqlite'?'owned.sqlite':'owned.json');
 const key=randomUUID(),schema='owned_activation_'+key.replaceAll('-',''),applicationName='owned_activation_'+key;
 const session={participantSessionId:key,tenantId:key,workspaceId:key,contentReleaseId:key,loginKey:'owned',groupKey:'owned',participantCode:'owned old code',executionMode:'run-hot-return',status:'signed_in',validUntil:'2026-10-12T00:00:00.000Z',createdAt:timestamp};
 const run={testRunId:key,participantSessionId:key,tenantId:key,workspaceId:key,contentReleaseId:key,bookletKey:'owned',bookletAssignmentKey:'owned#variant',executionMode:'run-hot-return',status:'paused',pauseSource:'participant',locked:false,currentUnitKey:'unit',unitResponses:{unit:'Exact saved answer Ä/β\n";'},testletTimers:{},createdAt:timestamp,updatedAt:timestamp,completedAt:null};
 const input={testRunId:key,participantSessionId:key,tenantId:key,workspaceId:key,contentReleaseId:key,activatedAt:timestamp};
 const storages=[];let rootPool,control,created=false;
 const url=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;
 url?.searchParams.set('options',`-c search_path=${schema}`);url?.searchParams.set('application_name',applicationName);
 const create=async()=>{
  if(kind==='memory')return createInMemoryFirstSliceRepository();
  if(kind==='file')return createFileFirstSliceRepository(file);
  if(kind==='sqlite')return createSqliteFirstSliceRepository(file);
  const storage=await createPostgresFirstSliceStorage(url.toString());storages.push(storage);return storage.repository;
 };
 const execute=query=>kind==='sqlite'?control.exec(query):control.query(query);
 let repository;
 try {
  if(url){assert.match(schema,/^owned_activation_[a-f0-9]+$/);rootPool=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await rootPool.query(`CREATE SCHEMA "${schema}"`);created=true;}
  repository=await create();
  if(kind==='sqlite')control=new DatabaseSync(file);
  if(url){const controlUrl=new URL(url);controlUrl.searchParams.set('application_name',applicationName+'_control');control=new Pool({connectionString:controlUrl.toString()});}
  const reset=async(sessionChanges={},runChanges={})=>{await repository.saveParticipantSession(structuredClone({...session,...sessionChanges}));await repository.saveTestRun(structuredClone({...run,...runChanges}));};
  const snapshot=async()=>({session:await repository.getParticipantSessionById(key),run:await repository.getTestRunById(key)});
  await t.test('activation changes only status, is idempotent and returns detached current fields',async()=>{
   await reset({participantCode:'owned new code',groupKey:'owned changed group'});const before=await snapshot();
   const result=await repository.activateParticipantController(input);assert.equal(result.activated,true);
   assert.deepEqual(result.participantSession,{...before.session,status:'launched'});assert.deepEqual((await snapshot()).run,before.run);
   result.participantSession.groupKey='caller mutation';
   const retry=await repository.activateParticipantController(input);assert.equal(retry.activated,false);assert.equal(retry.participantSession.groupKey,before.session.groupKey);
   if(kind!=='memory')assert.deepEqual(await (await create()).getParticipantSessionById(key),retry.participantSession);
  });
  await t.test('every immutable scope and missing parent/Run denies activation without changes',async()=>{
   await reset();const before=await snapshot();
   for(const field of ['testRunId','participantSessionId','tenantId','workspaceId','contentReleaseId'])assert.equal(await repository.activateParticipantController({...input,[field]:'foreign'}),null);
   assert.deepEqual(await snapshot(),before);
  });
  await t.test('closed, expired, completed and locked states cannot activate a controller',async()=>{
   for(const [parent,child,statusCode,errorCode] of [
    [{status:'closed'},{},409,'participant_session_closed'],
    [{validUntil:'2026-10-10T23:59:59.999Z'},{},410,'participant_access_expired'],
    [{},{status:'completed',completedAt:timestamp},409,'booklet_already_completed'],
    [{},{locked:true},423,'test_run_locked']
   ]){
    await reset(parent,child);const before=await snapshot();
    await assert.rejects(repository.activateParticipantController(input),error=>error.statusCode===statusCode&&error.errorCode===errorCode);
    assert.deepEqual(await snapshot(),before);
   }
   await reset({validUntil:timestamp},{pauseSource:'monitor'});
   assert.equal((await repository.activateParticipantController(input)).activated,true,'An eligible monitor-paused controller must receive its channel without resuming the Run.');
   assert.equal((await snapshot()).run.status,'paused');
  });
  await t.test('invalid activation timestamps never mutate storage',async()=>{
   await reset();const before=await snapshot();await assert.rejects(repository.activateParticipantController({...input,activatedAt:'invalid'}),/server timestamp/);assert.deepEqual(await snapshot(),before);
  });
  if(kind==='file')await t.test('failed persistence leaves the live parent inactive; retry and restart recover',async()=>{
   await reset();const before=await snapshot(),backup=join(directory,'backup.json');await rename(file,backup);await mkdir(file);
   try{await assert.rejects(repository.activateParticipantController(input));assert.deepEqual(await snapshot(),before);}
   finally{await rm(file,{recursive:true});await rename(backup,file);}
   assert.deepEqual(await (await create()).getParticipantSessionById(key),before.session);
   assert.equal((await repository.activateParticipantController(input)).activated,true);
   assert.equal((await (await create()).getParticipantSessionById(key)).status,'launched');
  });
  if(control)await t.test('failed SQL status update rolls back and releases locks; an idempotent receipt avoids a write',async()=>{
   await reset();const before=await snapshot();
   const install=kind==='sqlite'?`CREATE TRIGGER owned_activation_failure BEFORE UPDATE OF status ON participant_sessions WHEN NEW.status='launched' BEGIN SELECT RAISE(ABORT,'owned controller activation failure'); END`:
    `CREATE FUNCTION owned_activation_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned controller activation failure'; END $$; CREATE TRIGGER owned_activation_failure BEFORE UPDATE OF status ON participant_sessions FOR EACH ROW WHEN (NEW.status='launched') EXECUTE FUNCTION owned_activation_failure()`;
   const remove=kind==='sqlite'?'DROP TRIGGER owned_activation_failure':'DROP TRIGGER owned_activation_failure ON participant_sessions; DROP FUNCTION owned_activation_failure()';
   await execute(install);
   try{await assert.rejects(repository.activateParticipantController(input),/owned controller activation failure/);assert.deepEqual(await snapshot(),before);}
   finally{await execute(remove);}
   assert.equal((await (await create()).activateParticipantController(input)).activated,true);
   await execute(install);try{assert.equal((await repository.activateParticipantController(input)).activated,false);}finally{await execute(remove);}
  });
  if(kind==='postgres')for(const target of ['parent','run'])await t.test(`a separate SQL writer wins while activation waits on the ${target} row`,async()=>{
   await reset();const before=await snapshot(),writer=await control.connect();let pending,committed=false;
   try{
    await writer.query('BEGIN');
    if(target==='parent')await writer.query("UPDATE participant_sessions SET status='closed',participant_code='owned concurrent code' WHERE participant_session_id=$1",[key]);
    else await writer.query('UPDATE test_runs SET locked=true WHERE test_run_id=$1',[key]);
    const replica=await create();let settled=false;pending=replica.activateParticipantController(input).then(value=>({value}),error=>({error})).finally(()=>{settled=true;});
    let waiting=false;
    for(let attempt=0;attempt<100;attempt++){
     const active=await control.query("SELECT pid FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'",[applicationName]);
     if(active.rows.length){waiting=true;break;}await delay(25);
    }
    assert.equal(waiting,true,'The independent activation pool must demonstrably wait for the held row.');assert.equal(settled,false);
    await writer.query('COMMIT');committed=true;const result=await pending;
    assert.equal(result.error?.errorCode,target==='parent'?'participant_session_closed':'test_run_locked');
    const after=await snapshot();assert.equal(after.session.status,target==='parent'?'closed':'signed_in');
    if(target==='parent'){assert.equal(after.session.participantCode,'owned concurrent code');assert.deepEqual(after.run,before.run);}
    else assert.deepEqual(after.run,{...before.run,locked:true});
   }finally{if(!committed)await writer.query('ROLLBACK');writer.release();await pending;}
  });
  if(kind==='sqlite')for(const target of ['parent','run'])await t.test(`an independent SQLite worker closes the ${target} before activation reads it`,async()=>{
   await reset();const before=await snapshot();
   const worker=new Worker(`const {parentPort,workerData}=require('node:worker_threads');const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(workerData.file);db.exec('BEGIN IMMEDIATE');db.prepare(workerData.target==='parent'?"UPDATE participant_sessions SET status='closed',participant_code='owned concurrent code' WHERE participant_session_id=?":"UPDATE test_runs SET locked=1 WHERE test_run_id=?").run(workerData.key);parentPort.postMessage('locked');parentPort.once('message',()=>setTimeout(()=>{db.exec('COMMIT');db.close();parentPort.close();},300));`,{eval:true,workerData:{file,key,target}});
   const ready=new Promise((done,reject)=>{worker.once('message',done);worker.once('error',reject);});
   const finished=new Promise((done,reject)=>{worker.once('exit',code=>code===0?done():reject(Error('Owned SQLite activation worker failed')));worker.once('error',reject);});
   try{assert.equal(await ready,'locked');worker.postMessage('activate');await assert.rejects(repository.activateParticipantController(input),error=>error.errorCode===(target==='parent'?'participant_session_closed':'test_run_locked'));await finished;
    const after=await snapshot();assert.equal(after.session.status,target==='parent'?'closed':'signed_in');
    if(target==='parent'){assert.equal(after.session.participantCode,'owned concurrent code');assert.deepEqual(after.run,before.run);}else assert.deepEqual(after.run,{...before.run,locked:true});
   }finally{await worker.terminate();}
  });
 }finally{
  for(const storage of storages)await storage.shutdown();
  if(kind==='sqlite')control?.close();else await control?.end();
  try{if(created)await rootPool.query(`DROP SCHEMA "${schema}" CASCADE`);}finally{await rootPool?.end();await rm(directory,{recursive:true,force:true});}
 }
});
