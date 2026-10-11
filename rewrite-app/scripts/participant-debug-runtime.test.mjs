import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,mkdir,rename,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import test from 'node:test';
import {Pool} from 'pg';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {compileBookletRuntimePolicy} from '@testcenter-rewrite-app/contracts';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceRepository} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceRepository} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
const kinds=['memory','file','sqlite'];
if(process.env.FIRST_SLICE_STORE==='postgres'){assert.ok(process.env.FIRST_SLICE_POSTGRES_URL);kinds.push('postgres');}
const timestamp='2026-10-11T00:00:00.000Z';
for(const kind of kinds)test(`${kind}: debug commands and diagnostics preserve the selected Run`,async t=>{
 const directory=await mkdtemp(join(tmpdir(),'testcenter-debug-runtime-')),file=join(directory,kind==='file'?'owned.json':'owned.sqlite');
 const schema=`owned_debug_${randomUUID().replaceAll('-','')}`,url=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;
 url?.searchParams.set('options',`-c search_path=${schema}`);
 const rootPool=kind==='postgres'?new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL}):null;
 const storages=[];let repository,control,created=false;
 const create=async()=>{if(kind==='memory')return repository??createInMemoryFirstSliceRepository();if(kind==='file')return createFileFirstSliceRepository(file);
  if(kind==='sqlite')return createSqliteFirstSliceRepository(file);const storage=await createPostgresFirstSliceStorage(url.toString());storages.push(storage);return storage.repository;};
 const execute=sql=>kind==='sqlite'?control.exec(sql):control.query(sql);
 try{
  if(rootPool){await rootPool.query(`CREATE SCHEMA "${schema}"`);created=true;}
  repository=await create();if(kind==='sqlite')control=new DatabaseSync(file);else if(kind==='postgres')control=new Pool({connectionString:url.toString()});
  let clock=Date.parse(timestamp);const serviceFor=repo=>createFirstSliceServices({repository:repo,now:()=>new Date(clock).toISOString()});const service=serviceFor(repository);
  const tenant=await service.platform.createTenant({tenantKey:'owned-'+randomUUID(),displayName:'Owned debug test'});
  const workspace=await service.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'owned',displayName:'Owned debug test'});
  const keys={tenantKey:tenant.tenantKey,workspaceKey:workspace.workspaceKey},base={tenantId:tenant.tenantId,workspaceId:workspace.workspaceId};
  const releaseId=randomUUID();const condition={source:{type:'Score',unitKey:'unit',variableKey:'x',defaultValue:'0'},expression:{type:'greaterThan',value:'1'}};
  const booklet={bookletKey:'owned',displayLabel:'Owned',policy:compileBookletRuntimePolicy({}),unitEntries:[{unitKey:'unit',displayLabel:'Unit',unitDefinition:'<owned-definition/>'}],
   stateEntries:[{stateKey:'level',displayLabel:'Level',options:[{optionKey:'high',displayLabel:'High',conditions:[condition]},{optionKey:'base',displayLabel:'Base',conditions:[]}]}]};
  await repository.saveContentRelease({...base,contentReleaseId:releaseId,importJobId:releaseId,releaseLabel:'Owned',status:'active',createdAt:timestamp,activatedAt:timestamp,
   runtimeSnapshot:{bookletEntries:[booklet,{...structuredClone(booklet),bookletKey:'other',unitEntries:[{unitKey:'other-unit',displayLabel:'Other unit',unitDefinition:'<other-secret/>'}],stateEntries:[]}]}});
  const session={...base,participantSessionId:randomUUID(),contentReleaseId:releaseId,loginKey:'owned',groupKey:'owned',executionMode:'run-hot-return',status:'launched',createdAt:timestamp};
  await repository.saveParticipantSession(session);
  const response=score=>JSON.stringify({kind:'verona_unit_state',version:1,unitState:{unitStateDataType:'iqb-standard@1.0',responseProgress:'complete',dataParts:{one:JSON.stringify([{id:'x',status:'CODING_COMPLETE',value:'Exact answer Ä/β\n";',score}])}},playerState:{currentPage:'owned'}});
  const run={...base,participantSessionId:session.participantSessionId,testRunId:randomUUID(),contentReleaseId:releaseId,bookletKey:'owned',bookletAssignmentKey:'owned',executionMode:'run-hot-return',
   status:'paused',pauseSource:'monitor',currentUnitKey:'unit',unitResponses:{unit:response(2)},unitResponseFieldTimestamps:{unit:{dataParts:{one:1791676800000}}},sharedParameters:[{key:'owned',value:'shared'}],sharedParameterTimestamps:{owned:1791676800000},
   testletTimers:{owned:{testletKey:'owned',status:'paused',durationSeconds:300,remainingSeconds:123,startedAt:timestamp,expiresAt:null,updatedAt:timestamp,endedAt:null}},
   createdAt:timestamp,updatedAt:timestamp,completedAt:null};await repository.saveTestRun(run);
  const other={...run,testRunId:randomUUID(),bookletKey:'other',bookletAssignmentKey:'other',currentUnitKey:'other-unit',unitResponses:{'other-unit':'Other answer'}};await repository.saveTestRun(other);
  const foreignSession={...session,participantSessionId:randomUUID(),loginKey:'foreign'};await repository.saveParticipantSession(foreignSession);
  const foreign={...run,participantSessionId:foreignSession.participantSessionId,testRunId:randomUUID()};await repository.saveTestRun(foreign);
  const scope={participantSessionId:session.participantSessionId,testRunId:run.testRunId};
  const snapshot=async(repo=repository)=>({run:await repo.getTestRunById(run.testRunId),session:await repo.getParticipantSessionById(session.participantSessionId),
   other:await repo.getTestRunById(other.testRunId),foreign:await repo.getTestRunById(foreign.testRunId),logs:await repo.listParticipantTestLogsByWorkspace(base.tenantId,base.workspaceId),
   activity:await repo.listWorkspaceActivityEventsByWorkspace(base.tenantId,base.workspaceId)});
  const issue=args=>service.monitorControl.issueRunCommand({...keys,testRunId:run.testRunId,commandType:'debug',debugArguments:args,actorId:'owned-operator'});
  await t.test('read-only snapshots and local captures never persist answers, clocks, state choices or artifacts',async()=>{
   const before=await snapshot();const saved=await service.participantRuntime.getDebugState(scope);assert.equal(saved.adaptiveStates[0].optionKey,'high');
   assert.equal(saved.variables[0].variables[0].score,2);assert.equal(saved.booklet.unitEntries[0].unitDefinition,'<owned-definition/>');
   assert.ok(!JSON.stringify(saved).includes('other-secret'));
   const local=await service.participantRuntime.getDebugState({...scope,unitResponses:{unit:response(0)},conditionXml:'<If><Score of="x" from="unit"/><Is equal="0"/></If>'});
   assert.equal(local.adaptiveStates[0].optionKey,'base');assert.deepEqual(local.conditionResults,[true]);assert.deepEqual(await snapshot(),before);
   const otherSnapshot=await service.participantRuntime.getDebugState({...scope,testRunId:other.testRunId});assert.deepEqual(otherSnapshot.booklet.unitEntries.map(unit=>unit.unitKey),['other-unit']);
   assert.deepEqual(await snapshot(),before);
   saved.booklet.unitEntries[0].unitDefinition='untrusted';assert.deepEqual(await snapshot(),before);
  });
  await t.test('foreign Runs, wrong Unit overrides and invalid XML are rejected without a write',async()=>{
   const before=await snapshot();for(const id of [foreign.testRunId,'unknown'])await assert.rejects(service.participantRuntime.getDebugState({...scope,testRunId:id}),error=>error.errorCode==='test_run_not_found');
   for(const unitResponses of [null,[],{unit:42},{'other-unit':'foreign'}])await assert.rejects(service.participantRuntime.getDebugState({...scope,unitResponses}),error=>error.errorCode==='participant_debug_responses_invalid');
   for(const conditionXml of [42,'<Else/>','<If><Value/></If>','<If>','<!DOCTYPE If [<!ENTITY unsafe "owned">]><If/>','x'.repeat(32769)])
    await assert.rejects(service.participantRuntime.getDebugState({...scope,conditionXml}),error=>error.errorCode==='participant_debug_condition_invalid');
   assert.deepEqual(await snapshot(),before);
  });
  await t.test('content from another tenant or workspace cannot be exposed through a corrupted Run reference',async()=>{
   const release=await repository.getContentReleaseById(releaseId),before=await snapshot();
   for(const key of ['tenantId','workspaceId']){
    await repository.saveContentRelease({...release,[key]:randomUUID()});
    try{await assert.rejects(service.participantRuntime.getDebugState(scope),error=>error.errorCode==='test_run_not_found');assert.deepEqual(await snapshot(),before);}
    finally{await repository.saveContentRelease(release);}
   }
  });
  await t.test('native console logs remain idempotent across restart without changing a paused Run or its parent',async()=>{
   const before=await snapshot();const input={testRunId:run.testRunId,logs:[{unitKey:null,originalUnitId:null,entries:[{
    key:'command executed',timeStamp:Date.parse(timestamp),content:'debug on Exact console Ä/β',clientEntryId:'owned-console-debug'
   }]}]};
   assert.equal(await service.participantRuntime.saveTestLogs(input),1);const after=await snapshot();
   assert.deepEqual(after.run,before.run);assert.deepEqual(after.session,before.session);assert.deepEqual(after.other,before.other);
   assert.deepEqual(after.foreign,before.foreign);assert.deepEqual(after.activity,before.activity);assert.equal(after.logs.length,before.logs.length+1);
   const replica=await create();assert.equal(await serviceFor(replica).participantRuntime.saveTestLogs(input),1);
   assert.deepEqual(await snapshot(replica),after);
   const substituted=structuredClone(input);substituted.logs[0].entries[0].content='substituted';substituted.logs[0].entries[0].timeStamp++;
   assert.equal(await serviceFor(replica).participantRuntime.saveTestLogs(substituted),1);assert.deepEqual(await snapshot(replica),after);
  });
  await t.test('issuance and ACK preserve the exact paused Run; applying after ERROR writes only the receipt, command log and audit',async()=>{
   const before=await snapshot(),args=['on','Exact Ä/β\n";'];const command=await issue(args);args[0]='untrusted';assert.deepEqual(command.debugArguments,['on','Exact Ä/β\n";']);
   assert.deepEqual((await snapshot()).run,before.run);assert.deepEqual((await snapshot()).session,before.session);assert.deepEqual((await snapshot()).logs,before.logs);
   const acknowledged=await service.participantRuntime.acknowledgeCommand({...scope,commandId:command.commandId});assert.deepEqual(acknowledged.debugArguments,command.debugArguments);
   assert.deepEqual((await snapshot()).run,before.run);clock+=2000;
   const result=await service.participantRuntime.executeCommand({...scope,commandId:command.commandId,controllerStatus:'ERROR'});assert.equal(result.applied,true);
   const after=await snapshot();assert.deepEqual(after.run,before.run);assert.deepEqual(after.session,before.session);assert.deepEqual(after.other,before.other);assert.deepEqual(after.foreign,before.foreign);
   const added=after.logs.filter(log=>!before.logs.some(existing=>existing.participantTestLogId===log.participantTestLogId));
   assert.equal(after.logs.length,before.logs.length+1);assert.equal(added.length,1);assert.equal(added[0].logKey,'command executed');assert.equal(added[0].logContent,'debug on Exact Ä/β\n";');
   assert.equal(after.logs.filter(log=>log.logKey==='CONTROLLER').length,0);
   assert.equal(after.activity.filter(event=>event.eventType==='monitor_run_command_executed').length,1);
   const replica=await create(),retry=await serviceFor(replica).participantRuntime.executeCommand({...scope,commandId:command.commandId,controllerStatus:'PAUSED'});
   assert.equal(retry.applied,false);assert.deepEqual(retry.command,result.command);assert.deepEqual(await snapshot(replica),after);
  });
  await t.test('arguments bind the stored identity and cannot be substituted or attached to another keyword',async()=>{
   for(const debugArguments of [null,'off',[42]])await assert.rejects(issue(debugArguments),error=>error.errorCode==='monitor_debug_arguments_invalid');
   await assert.rejects(service.monitorControl.issueRunCommand({...keys,testRunId:run.testRunId,commandType:'pause',debugArguments:[]}),error=>error.errorCode==='monitor_debug_arguments_invalid');
   const queued=await repository.appendParticipantRunCommand({...base,...scope,commandId:'owned-debug-identity',commandType:'debug',debugArguments:['off'],targetUnitKey:null,remainingSeconds:null,actorId:null,issuedAt:timestamp,effectsDeferred:true});
   queued.debugArguments[0]='untrusted';
   const input={...base,...scope,commandId:'owned-debug-identity',commandType:'debug',debugArguments:['off'],targetUnitKey:null,remainingSeconds:null,actorId:null,issuedAt:timestamp,effectsDeferred:true};
   assert.deepEqual((await repository.appendParticipantRunCommand(input)).debugArguments,['off']);
   await assert.rejects(repository.appendParticipantRunCommand({...input,debugArguments:['on']}),/identity|different|immutable|reused/i);
  });
  if(kind==='file'||control)await t.test('failed command-log persistence rolls back application; an exact retry survives restart',async()=>{
   const command=await issue(['off']);await service.participantRuntime.acknowledgeCommand({...scope,commandId:command.commandId});const before=await snapshot();
   const backup=join(directory,'backup.json');const install=kind==='sqlite'?"CREATE TRIGGER owned_debug_failure BEFORE INSERT ON participant_test_logs WHEN NEW.log_key='command executed' BEGIN SELECT RAISE(ABORT,'owned debug failure'); END":
    "CREATE FUNCTION owned_debug_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned debug failure'; END $$; CREATE TRIGGER owned_debug_failure BEFORE INSERT ON participant_test_logs FOR EACH ROW WHEN (NEW.log_key='command executed') EXECUTE FUNCTION owned_debug_failure()";
   if(kind==='file'){await rename(file,backup);await mkdir(file);}else await execute(install);
   try{await assert.rejects(service.participantRuntime.executeCommand({...scope,commandId:command.commandId,controllerStatus:'ERROR'}));if(kind!=='file')assert.deepEqual(await snapshot(),before);}
   finally{if(kind==='file'){await rm(file,{recursive:true});await rename(backup,file);}else await execute(kind==='sqlite'?'DROP TRIGGER owned_debug_failure':'DROP TRIGGER owned_debug_failure ON participant_test_logs; DROP FUNCTION owned_debug_failure()');}
   assert.deepEqual(await snapshot(),before);assert.deepEqual(await snapshot(await create()),before);
   const result=await service.participantRuntime.executeCommand({...scope,commandId:command.commandId,controllerStatus:'ERROR'});assert.equal(result.applied,true);
   assert.deepEqual((await snapshot()).run,before.run);assert.equal((await snapshot()).logs.length,before.logs.length+1);
   assert.equal((await serviceFor(await create()).participantRuntime.executeCommand({...scope,commandId:command.commandId})).applied,false);
  });
  await t.test('non-receiving modes cannot accept a remote Debug command',async()=>{
   const before=await snapshot();await repository.saveTestRun({...before.run,executionMode:'run-demo'});
   await assert.rejects(issue([]),error=>error.errorCode==='monitor_run_commands_disabled');
   const diagnostic=await service.participantRuntime.getDebugState({...scope,unitResponses:{unit:response(1)}});assert.equal(diagnostic.variables[0].variables[0].score,1);
   assert.deepEqual((await snapshot()).run,{...before.run,executionMode:'run-demo'});await repository.saveTestRun(before.run);
  });
 }finally{
  for(const storage of storages)await storage.shutdown();if(kind==='sqlite')control?.close();else await control?.end();
  try{if(created)await rootPool.query(`DROP SCHEMA "${schema}" CASCADE`);}finally{await rootPool?.end();await rm(directory,{recursive:true,force:true});}
 }
});
