import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {Pool} from 'pg';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceStorage} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
test('actual unchanged Source keeps lock clocks separate from saved Test state and uses whole-second native result times',async()=>{
 const root=new URL('../test-fixtures/original-testcenter/source-workspace-results/lock-clock/',import.meta.url);
 const manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
 assert.equal(manifest.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');
 assert.equal(manifest.probeCommit,'e4cf2a9d1be066bcb3fb31b6dd5ad1ec027c3826');assert.equal(manifest.checks,29);
 for(const [name,sha]of Object.entries(manifest.files)){
  assert.match(name,/^[a-z0-9][a-z0-9.-]*$/);
  assert.equal(createHash('sha256').update(await readFile(new URL(name,root))).digest('hex'),sha,name);
 }
 const receipt=JSON.parse(await readFile(new URL('receipt.json',root),'utf8'));
 assert.equal(receipt.success,true);assert.equal(receipt.testMode,false);assert.equal(receipt.checks.length,29);
 const clock=receipt.checks.find(item=>item.name==='locking and same-value relocking advance Test time without nonempty Test state or Unit rows');
 assert.equal(clock.unopenedRemainedAbsent,true);assert.equal(clock.emptyStateRemainedAbsent,true);
 const times=['openedTime','lockedTime','relockedTime','unlockedTime'].map(key=>clock[key]);
 assert.ok(times.every(value=>Number.isSafeInteger(value)&&value>0&&value<100_000_000_000));
 assert.ok(times.every((value,index)=>index===0||value>times[index-1]));
 assert.equal(receipt.checks.find(item=>item.name==='actual Unit definition/state/log writes leave Test-level result time unchanged').testTime,clock.unlockedTime);
});
const stamp=n=>new Date(Date.parse('2026-10-23T00:00:00.000Z')+n*60000).toISOString();
const kinds=['memory','file','sqlite'];
if(process.env.FIRST_SLICE_STORE==='postgres'){assert.ok(process.env.FIRST_SLICE_POSTGRES_URL);kinds.push('postgres');}
for(const kind of kinds)test(`${kind}: Original result evidence separates opened Tests, Test state and Unit writes`,async t=>{
 const directory=await mkdtemp(join(tmpdir(),'owned-original-results-')),file=join(directory,kind==='file'?'state.json':'state.sqlite');
 const id=randomUUID(),schema='owned_original_result_'+id.replaceAll('-',''),url=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;
 url?.searchParams.set('options','-c search_path='+schema);
 let storage,repository,root,created=false,control;
 const open=async()=>{
  storage=kind==='memory'?storage??{repository:createInMemoryFirstSliceRepository(),shutdown:async()=>{}}
   :kind==='file'?await createFileFirstSliceStorage(file)
   :kind==='sqlite'?await createSqliteFirstSliceStorage(file):await createPostgresFirstSliceStorage(url.toString());
  repository=storage.repository;
 };
 const scope={tenantId:id,workspaceId:id,contentReleaseId:id,participantSessionId:id};
 const input={...scope,testRunId:id};
 const read=()=>repository.getTestRunById(id);
 const mutate=(project,extra={})=>repository.mutateParticipantRun(input,context=>({testRun:project(context.testRun),testLogs:[],activityEvents:[],...extra}));
 try{
  if(url){root=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await root.query(`CREATE SCHEMA "${schema}"`);created=true;}
  await open();
  await repository.saveTenant({tenantId:id,tenantKey:id,displayName:'Owned results',status:'active',createdAt:stamp(0)});
  await repository.saveWorkspace({tenantKey:id,workspaceKey:id,workspace:{tenantId:id,workspaceId:id,workspaceKey:id,displayName:'Owned results',status:'active',createdAt:stamp(0)}});
  await repository.saveParticipantSession({...scope,loginKey:'owned',groupKey:'owned',status:'signed_in',createdAt:stamp(0)});
  await repository.saveTestRun({...input,bookletKey:'owned',executionMode:'run-hot-return',status:'created',currentUnitKey:null,
   unitResponses:{},originalResultState:{lastOpenedAt:null,lastTestStateAt:null,hasTestState:false},createdAt:stamp(0),updatedAt:stamp(0),completedAt:null});
  await t.test('creating an unopened Test persists no opened or nonempty Test-state evidence',async()=>{
   assert.deepEqual((await read()).originalResultState,{lastOpenedAt:null,lastTestStateAt:null,hasTestState:false});
   if(kind!=='memory'){await storage.shutdown();await open();}
   assert.deepEqual((await read()).originalResultState,{lastOpenedAt:null,lastTestStateAt:null,hasTestState:false});
  });
  await t.test('opening counts independently of progress status and does not invent Test state',async()=>{
   const result=await repository.activateParticipantController({...input,activatedAt:stamp(1)});
   assert.equal(result.entryChanged,true);assert.equal(result.testRun.status,'created');
   assert.deepEqual((await read()).originalResultState,{lastOpenedAt:stamp(1),lastTestStateAt:null,hasTestState:false,lastTestModifiedAt:stamp(1)});
   assert.equal((await read()).updatedAt,stamp(0),'Canonical Run activity time is a separate contract.');
  });
  await t.test('locking changes Test-row time without manufacturing saved Test state, including non-saving mode and same-value lock writes',async()=>{
   for(const executionMode of ['run-hot-return','run-review'])for(const opened of [false,true]){
    const target={...input,testRunId:id+'-lock-'+executionMode+'-'+opened};
    await repository.saveTestRun({...await read(),...target,executionMode,locked:false,currentUnitKey:null,unitResponses:{},
     controllerEntry:opened?(await read()).controllerEntry:undefined,
     originalResultState:{lastOpenedAt:opened?stamp(1):null,lastTestStateAt:null,hasTestState:false,lastTestModifiedAt:opened?stamp(1):null}});
    const write=(locked,n,extra={})=>repository.mutateParticipantRun(target,context=>({testRun:{...context.testRun,locked,updatedAt:stamp(n)},testLogs:[],activityEvents:[],...extra}));
    await write(true,12);
    let saved=await repository.getTestRunById(target.testRunId);
    assert.equal(saved.originalResultState.hasTestState,false,'A Source lock updates tests.locked/timestamp_server, not tests.laststate.');
    assert.equal(saved.originalResultState.lastTestStateAt,null);assert.equal(saved.originalResultState.lastTestModifiedAt,stamp(12));
    assert.equal(saved.originalResultState.lastOpenedAt,opened?stamp(1):null);
    await write(false,13);saved=await repository.getTestRunById(target.testRunId);
    assert.equal(saved.originalResultState.lastTestModifiedAt,stamp(13));assert.equal(saved.originalResultState.hasTestState,false);
    await write(false,14,{originalResultModifiedAt:stamp(14)});saved=await repository.getTestRunById(target.testRunId);
    assert.equal(saved.originalResultState.lastTestModifiedAt,stamp(14));assert.equal(saved.originalResultState.hasTestState,false);
    await assert.rejects(write(false,15,{originalResultModifiedAt:'invalid timestamp'}));
    assert.deepEqual(await repository.getTestRunById(target.testRunId),saved);
   }
  });
  await t.test('Unit answers and raw logs preserve Test timestamp and resist projected metadata injection',async()=>{
   const evidence=structuredClone((await read()).originalResultState);
   await mutate(run=>({...run,updatedAt:stamp(2),unitResponses:{unit:JSON.stringify({kind:'verona_unit_state',version:1,unitState:{presentationProgress:'some'}})},
    originalResultState:{lastOpenedAt:stamp(99),lastTestStateAt:stamp(99),lastTestModifiedAt:stamp(99),hasTestState:true}}));
   await repository.saveParticipantTestLogs([{...input,participantTestLogId:randomUUID(),unitKey:null,originalUnitId:null,
    logKey:'CURRENT_UNIT_ID',logContent:'arbitrary log is not a state patch',timestamp:Date.parse(stamp(99)),recordedAt:stamp(2)}]);
   assert.deepEqual((await read()).originalResultState,evidence);
   assert.equal((await read()).updatedAt,stamp(2));
  });
  await t.test('an explicit same-value Test-state write and later navigation advance only server time',async()=>{
   await mutate(run=>({...run,updatedAt:stamp(3)}),{originalResultTestStateAt:stamp(3)});
   assert.deepEqual((await read()).originalResultState,{lastOpenedAt:stamp(1),lastTestStateAt:stamp(3),hasTestState:true,lastTestModifiedAt:stamp(3)});
   await mutate(run=>({...run,currentUnitKey:'unit',status:'running',updatedAt:stamp(4)}));
   assert.deepEqual((await read()).originalResultState,{lastOpenedAt:stamp(1),lastTestStateAt:stamp(4),hasTestState:true,lastTestModifiedAt:stamp(4)});
   await mutate(run=>({...run,updatedAt:stamp(5),unitResponses:{...run.unitResponses,unit:'Exact saved answer Ω'}}));
   assert.equal((await read()).originalResultState.lastTestStateAt,stamp(4));
  });
  await t.test('reopening touches its own timestamp without changing answers and has an idempotent same-time retry',async()=>{
   const before=await read();const result=await repository.activateParticipantController({...input,activatedAt:stamp(6)});
   assert.equal(result.entryChanged,true);assert.equal(result.testRun.controllerEntry.revision,before.controllerEntry.revision);
   assert.deepEqual(result.testRun.unitResponses,before.unitResponses);
   assert.deepEqual(result.testRun.originalResultState,{lastOpenedAt:stamp(6),lastTestStateAt:stamp(4),hasTestState:true,lastTestModifiedAt:stamp(6)});
   const after=await read();assert.equal((await repository.activateParticipantController({...input,activatedAt:stamp(6)})).entryChanged,false);
   assert.deepEqual(await read(),after);
   if(kind!=='memory'){await storage.shutdown();await open();assert.deepEqual(await read(),after);}
  });
  await t.test('scope mismatch, invalid timestamp and an uncloneable audit leave the full current Run intact',async()=>{
   const event={...scope,activityEventId:randomUUID(),eventType:'owned',actorId:null,subjectType:'test_run',subjectId:id,
    occurredAt:stamp(7),summary:'Owned rollback boundary',details:{}};
   await repository.saveWorkspaceActivityEvent(event);const before=await read();
   assert.equal(await repository.activateParticipantController({...input,workspaceId:'foreign',activatedAt:stamp(7)}),null);
   await assert.rejects(repository.activateParticipantController({...input,activatedAt:'invalid timestamp'}));
   await assert.rejects(mutate(run=>({...run,currentUnitKey:'later',updatedAt:stamp(7)}),{activityEvents:[{...event,details:{invalid:()=>{}}}]}));
   await assert.rejects(mutate(run=>run,{terminationNoop:true,originalResultModifiedAt:stamp(7)}),/terminal early return/);
   assert.deepEqual(await read(),before);
  });
  await t.test('a superseded controller cannot advance opened/state timestamps or manufacture legacy history',async()=>{
   await repository.saveTestRun({...await read(),controllerDispatches:{owned:4}});const before=await read();
   const result=await mutate(run=>({...run,currentUnitKey:'late',updatedAt:stamp(8)}),{controllerDispatch:{controllerId:'owned',sequence:3},
    originalResultOpenedAt:stamp(8),originalResultTestStateAt:stamp(8),originalResultModifiedAt:stamp(8)});
   assert.equal(result.superseded,true);assert.deepEqual((await read()).originalResultState,before.originalResultState);
   const legacy={...before,testRunId:id+'-legacy',originalResultState:undefined};await repository.saveTestRun(legacy);
   await repository.mutateParticipantRun({...input,testRunId:legacy.testRunId},context=>({testRun:{...context.testRun,
    updatedAt:stamp(8),unitResponses:{unit:'Legacy exact answer'}},testLogs:[],activityEvents:[]}));
   assert.equal((await repository.getTestRunById(legacy.testRunId)).originalResultState,undefined);
  });
  await t.test('non-saving review mode records opening but does not turn navigation into saved Test state',async()=>{
   const nonSaving={...await read(),testRunId:id+'-review',executionMode:'run-review',controllerDispatches:undefined,
    originalResultState:{lastOpenedAt:null,lastTestStateAt:null,hasTestState:false}};
   await repository.saveTestRun(nonSaving);const target={...input,testRunId:nonSaving.testRunId};
   await repository.activateParticipantController({...target,activatedAt:stamp(10)});
   await repository.mutateParticipantRun(target,context=>({testRun:{...context.testRun,currentUnitKey:'other',updatedAt:stamp(11)},testLogs:[],activityEvents:[]}));
   const before=await repository.getTestRunById(nonSaving.testRunId);
   assert.deepEqual(before.originalResultState,{lastOpenedAt:stamp(10),lastTestStateAt:null,hasTestState:false,lastTestModifiedAt:stamp(10)});
   await assert.rejects(repository.mutateParticipantRun(target,context=>({testRun:context.testRun,testLogs:[],activityEvents:[],originalResultTestStateAt:stamp(11)})),/non-saving/);
   assert.deepEqual(await repository.getTestRunById(nonSaving.testRunId),before);
  });
  if(['sqlite','postgres'].includes(kind))await t.test('a real late SQL audit failure rolls back result clocks together with the Run',async()=>{
   const event={...scope,activityEventId:randomUUID(),eventType:'owned',actorId:null,subjectType:'test_run',subjectId:id,
    occurredAt:stamp(9),summary:'Owned real SQL rollback',details:{}};
   control=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()});
   const execute=async sql=>kind==='sqlite'?control.exec(sql):control.query(sql);
   try{
    if(kind==='sqlite')await execute(`CREATE TRIGGER owned_result_audit_fail BEFORE INSERT ON workspace_activity_events
      WHEN NEW.activity_event_id = '${event.activityEventId}' BEGIN SELECT RAISE(ABORT,'owned result audit failure'); END`);
    else await execute(`CREATE FUNCTION owned_result_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.activity_event_id = '${event.activityEventId}' THEN RAISE EXCEPTION 'owned result audit failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER owned_result_audit_fail BEFORE INSERT ON workspace_activity_events FOR EACH ROW EXECUTE FUNCTION owned_result_audit_fail()`);
    const before=await read();
    await assert.rejects(mutate(run=>({...run,currentUnitKey:'late-audit',updatedAt:stamp(9)}),{
      originalResultOpenedAt:stamp(9),originalResultTestStateAt:stamp(9),activityEvents:[event]}),/owned result audit failure/);
    assert.deepEqual(await read(),before);
   }finally{
    if(kind==='sqlite'){await execute('DROP TRIGGER IF EXISTS owned_result_audit_fail');control.close();}
    else{await execute('DROP TRIGGER IF EXISTS owned_result_audit_fail ON workspace_activity_events; DROP FUNCTION IF EXISTS owned_result_audit_fail()');await control.end();}
    control=null;
   }
  });
  if(['sqlite','postgres'].includes(kind))await t.test('upgrading the schema before Original result metadata retains legacy answers without fabricating result timestamps',async()=>{
   const legacyId=id+'-legacy',before=await repository.getTestRunById(legacyId);await storage.shutdown();
   // This historical fixture predates result metadata, independently of later migrations.
   const version=kind==='sqlite'?66:60;
   if(kind==='sqlite'){
    control=new DatabaseSync(file);control.exec('ALTER TABLE test_runs DROP COLUMN response_part_types_json; DROP TABLE original_session_tokens; DROP INDEX participant_access_credentials_token_hash; DROP TABLE original_login_bindings; DROP TABLE original_participant_groups; DROP INDEX participant_sessions_original_login; ALTER TABLE participant_sessions DROP COLUMN original_name_suffix; ALTER TABLE participant_sessions DROP COLUMN original_login_key; ALTER TABLE participant_roster_entries DROP COLUMN original_login_identity; ALTER TABLE test_runs DROP COLUMN original_result_state_json');
    control.prepare('DELETE FROM schema_migrations WHERE version >= ?').run(version);control.close();control=null;
   }else{
    control=new Pool({connectionString:url.toString()});await control.query('ALTER TABLE test_runs DROP COLUMN response_part_types_json; DROP TABLE original_session_tokens; DROP INDEX participant_access_credentials_token_hash; DROP TABLE original_login_bindings; DROP TABLE original_participant_groups; DROP INDEX participant_sessions_original_login; ALTER TABLE participant_sessions DROP COLUMN original_name_suffix; ALTER TABLE participant_sessions DROP COLUMN original_login_key; ALTER TABLE participant_roster_entries DROP COLUMN original_login_identity; ALTER TABLE test_runs DROP COLUMN original_result_state_json');
    await control.query('DELETE FROM schema_migrations WHERE version >= $1',[version]);await control.end();control=null;
   }
   await open();assert.deepEqual(await repository.getTestRunById(legacyId),before);
  });
 }finally{
  try{await storage?.shutdown();if(control){if(kind==='sqlite')control.close();else await control.end();}}
  finally{try{if(created)await root.query(`DROP SCHEMA "${schema}" CASCADE`);}finally{await root?.end();await rm(directory,{recursive:true,force:true});}}
 }
});
