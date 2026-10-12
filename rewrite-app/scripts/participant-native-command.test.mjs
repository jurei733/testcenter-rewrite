import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm,rename,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {Pool} from 'pg';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {compileBookletRuntimePolicy} from '@testcenter-rewrite-app/contracts';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceRepository} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceRepository} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
const kinds=['memory','file','sqlite'];if(process.env.FIRST_SLICE_STORE==='postgres'){assert.ok(process.env.FIRST_SLICE_POSTGRES_URL);kinds.push('postgres');}
const epoch=Date.parse('2026-10-12T00:00:00.000Z'),timestamp=new Date(epoch).toISOString();
for(const kind of kinds)test(`${kind}: native console commands bind immutable scope and commit without remote ACK`,async t=>{
 const directory=await mkdtemp(join(tmpdir(),'testcenter-native-')),file=join(directory,kind==='file'?'owned.json':'owned.sqlite');
 const schema='owned_native_'+randomUUID().replaceAll('-',''),url=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;
 url?.searchParams.set('options',`-c search_path=${schema}`);const root=kind==='postgres'?new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL}):null;
 const storages=[];let repository,control,created=false,clock=epoch;
 const create=async()=>{if(kind==='memory')return repository??createInMemoryFirstSliceRepository();if(kind==='file')return createFileFirstSliceRepository(file);
  if(kind==='sqlite')return createSqliteFirstSliceRepository(file);const storage=await createPostgresFirstSliceStorage(url.toString());storages.push(storage);return storage.repository;};
 const services=repo=>createFirstSliceServices({repository:repo,now:()=>new Date(clock).toISOString()});
 try{
  if(root){await root.query(`CREATE SCHEMA "${schema}"`);created=true;}
  repository=await create();if(kind==='sqlite')control=new DatabaseSync(file);else if(root)control=new Pool({connectionString:url.toString()});
  const service=services(repository),tenant=await service.platform.createTenant({tenantKey:'owned-'+randomUUID(),displayName:'Owned native'});
  const workspace=await service.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'owned',displayName:'Owned native'});
  const base={tenantId:tenant.tenantId,workspaceId:workspace.workspaceId},releaseId=randomUUID();
  const booklet={bookletKey:'owned',displayLabel:'Owned',policy:compileBookletRuntimePolicy({}),testletEntries:[
   {testletKey:'outer',displayLabel:'Outer',parentTestletKey:null,restrictions:{codeToEnter:{code:'OUTER',prompt:'Outer'}}},
   {testletKey:'inner',displayLabel:'Inner',parentTestletKey:'outer',restrictions:{codeToEnter:{code:'INNER',prompt:'Inner'},lockAfterLeaving:{scope:'testlet',confirm:false}}},
   {testletKey:'time-a',displayLabel:'A',parentTestletKey:null,restrictions:{timeMax:{minutes:5,leave:'confirm'}}},
   {testletKey:'time-b',displayLabel:'B',parentTestletKey:null,restrictions:{timeMax:{minutes:5,leave:'confirm'}}}],
   unitEntries:[{unitKey:'unit',displayLabel:'Unit',testletPath:['outer']},{unitKey:'alias-Ω',originalUnitId:'original-not-alias',displayLabel:'Alias',testletPath:['outer','inner']},
    {unitKey:'timed-a',displayLabel:'A',testletPath:['time-a']},{unitKey:'timed-b',displayLabel:'B',testletPath:['time-b']}]};
  await repository.saveContentRelease({...base,contentReleaseId:releaseId,importJobId:releaseId,releaseLabel:'Owned',status:'active',createdAt:timestamp,activatedAt:timestamp,runtimeSnapshot:{bookletEntries:[booklet]}});
  const parent={...base,participantSessionId:randomUUID(),contentReleaseId:releaseId,loginKey:'owned',groupKey:'owned',executionMode:'run-hot-return',status:'launched',createdAt:timestamp};await repository.saveParticipantSession(parent);
  const run={...base,testRunId:randomUUID(),participantSessionId:parent.participantSessionId,contentReleaseId:releaseId,bookletKey:'owned',bookletAssignmentKey:'owned',executionMode:'run-hot-return',status:'running',currentUnitKey:'unit',
   unitResponses:{unit:'Exact Ä/β\n"; answer'},unitResponseFieldTimestamps:{unit:{opaque:123}},sharedParameters:[{key:'shared',value:'Owned'}],sharedParameterTimestamps:{shared:125},
   unlockedTestletKeys:[],lockedTestletKeys:['inner'],lockedUnitKeys:['alias-Ω'],testletTimers:{},createdAt:timestamp,updatedAt:timestamp,completedAt:null};await repository.saveTestRun(run);
  const sibling={...structuredClone(run),testRunId:randomUUID(),unitResponses:{unit:'Sibling'}};await repository.saveTestRun(sibling);
  const foreignParent={...parent,participantSessionId:randomUUID()};await repository.saveParticipantSession(foreignParent);
  const foreign={...run,testRunId:randomUUID(),participantSessionId:foreignParent.participantSessionId};await repository.saveTestRun(foreign);
  const input=(keyword,args=[],extra={})=>({participantSessionId:parent.participantSessionId,testRunId:run.testRunId,contentReleaseId:releaseId,bookletKey:'owned',deliveryId:randomUUID(),keyword,arguments:args,controllerStatus:'RUNNING',timeStamp:clock,...extra});
  const invoke=(request,repo=repository)=>services(repo).participantRuntime.executeNativeCommand(request);
  const receipt=async(request,repo)=>{let value;const current=await repo.getTestRunById(run.testRunId);
   await repo.mutateParticipantRun({...current,deliveryId:'console:'+request.deliveryId},context=>{value=context.progressDelivery;return null;});return value??null;};
  const snapshot=async(request,repo=repository)=>({run:await repo.getTestRunById(run.testRunId),parent:await repo.getParticipantSessionById(parent.participantSessionId),
   sibling:await repo.getTestRunById(sibling.testRunId),foreign:await repo.getTestRunById(foreign.testRunId),release:await repo.getContentReleaseById(releaseId),
   commands:await repo.listPendingParticipantRunCommands(run),logs:await repo.listParticipantTestLogsByWorkspace(base.tenantId,base.workspaceId),events:await repo.listWorkspaceActivityEventsByWorkspace(base.tenantId,base.workspaceId),
   receipt:request?await receipt(request,repo):null});
  const preserve=(actual,expected)=>{for(const key of ['unitResponses','unitResponseFieldTimestamps','sharedParameters','sharedParameterTimestamps','createdAt','executionMode','bookletAssignmentKey'])assert.deepEqual(actual[key],expected[key],key);};
  await t.test('controller context is an authorized read independent of current Unit loading and update chronology',async()=>{
   const before=await snapshot();
   for(const id of [run.testRunId,sibling.testRunId]){
    const context=await services(repository).participantRuntime.getControllerContext({participantSessionId:parent.participantSessionId,testRunId:id});
    assert.equal(context.testRun.testRunId,id);assert.equal(context.participantSession.participantSessionId,parent.participantSessionId);
    preserve(context.testRun,id===run.testRunId?run:sibling);assert.equal(Object.hasOwn(context,'currentUnit'),false);
   }
   const legacy=await services(repository).participantRuntime.getControllerContext({participantSessionId:parent.participantSessionId});
   assert.equal(legacy.testRun.participantSessionId,parent.participantSessionId);
   for(const id of [foreign.testRunId,'missing',' '])await assert.rejects(services(repository).participantRuntime.getControllerContext({participantSessionId:parent.participantSessionId,testRunId:id}));
   assert.deepEqual(await snapshot(),before);
  });
  await t.test('all modes support local commands without a delivery queue, with mode-filtered logs and exact retry after restart',async()=>{
   for(const mode of ['run-hot-return','run-hot-restart','run-simulation','run-demo','run-review','run-trial']){
    await repository.saveTestRun({...run,executionMode:mode});const request=input('pause',['Exact Ä/β\n";']);const before=await snapshot(request);
    const result=await invoke(request);assert.equal(result.applied,true);assert.equal(result.testRun.status,'paused');assert.equal(result.testRun.pauseSource,'participant');preserve(result.testRun,before.run);
    const after=await snapshot(request);assert.deepEqual(after.commands,before.commands);assert.deepEqual(after.sibling,before.sibling);assert.deepEqual(after.foreign,before.foreign);assert.deepEqual(after.release,before.release);
    const saved=!['run-demo','run-review','run-simulation'].includes(mode);assert.equal(after.logs.length-before.logs.length,saved?2:0);if(saved)assert.equal(after.logs.filter(log=>log.participantTestLogId.startsWith(`delivery:${run.testRunId}:console:${request.deliveryId}:`)&&log.logKey==='command executed')[0].logContent,'pause Exact Ä/β\n";');
    assert.equal(after.events.length,before.events.length+1);clock+=2_000;
    const replica=await create(),replayed=await invoke(request,replica);assert.equal(replayed.applied,false);assert.equal(replayed.executedAt,result.executedAt);assert.deepEqual(await snapshot(request,replica),after);
   }
   await repository.saveTestRun(run);
  });
  await t.test('LOADING commands retain their observation, log real controller transitions and replay the exact receipt',async()=>{
   for(const [keyword,controller] of [['resume','RUNNING'],['pause','PAUSED'],['terminate','TERMINATED']]){
    await repository.saveTestRun(run);const request=input(keyword,[],{controllerStatus:'LOADING'}),before=await snapshot(request);
    const result=await invoke(request);assert.equal(result.controllerStatus,'LOADING');preserve(result.testRun,run);
    const after=await snapshot(request,await create()),logs=after.logs.filter(log=>log.participantTestLogId.startsWith(`delivery:${run.testRunId}:console:${request.deliveryId}:`));
    assert.deepEqual(logs.filter(log=>log.logKey==='CONTROLLER').map(log=>log.logContent),[controller]);
    assert.equal(logs.filter(log=>log.logKey==='command executed'&&log.logContent===keyword).length,1);
    for(const key of ['commands','sibling','foreign','release'])assert.deepEqual(after[key],before[key]);
    const replay=await invoke(request,await create());assert.equal(replay.applied,false);assert.equal(replay.controllerStatus,'LOADING');assert.equal(replay.executedAt,result.executedAt);
    await assert.rejects(invoke({...request,controllerStatus:'RUNNING'}),error=>error.errorCode==='participant_delivery_conflict');
    assert.deepEqual(await snapshot(request,await create()),after);
   }
   // An obsolete loading observation cannot erase a pause already committed by
   // another controller; termination must retain the paused terminal variant.
   await repository.saveTestRun({...run,status:'paused',pauseSource:'monitor'});
   const request=input('terminate',[],{controllerStatus:'LOADING'});await invoke(request);
   const logs=(await snapshot(request)).logs.filter(log=>log.participantTestLogId.startsWith(`delivery:${run.testRunId}:console:${request.deliveryId}:`));
   assert.deepEqual(logs.filter(log=>log.logKey==='CONTROLLER').map(log=>log.logContent),['TERMINATED_PAUSED']);
   await repository.saveTestRun(run);
  });
  await t.test('loading observations obey execution-mode logging without adding an answer',async()=>{
   for(const mode of ['run-hot-return','run-hot-restart','run-simulation','run-demo','run-review','run-trial']){
    const original={...run,executionMode:mode};await repository.saveTestRun(original);
    const request=input('resume',[],{controllerStatus:'LOADING'}),before=await snapshot(request);const result=await invoke(request);
    preserve(result.testRun,original);const after=await snapshot(request);
    assert.equal(after.logs.length-before.logs.length,!['run-demo','run-review','run-simulation'].includes(mode)?2:0);
    assert.deepEqual(after.commands,before.commands);
   }
   await repository.saveTestRun(run);
  });
  await t.test('resume preserves inactive cached timers and restores only the current interrupted countdown',async()=>{
   const original={...run,currentUnitKey:'timed-a',testletTimers:{'time-a':{testletKey:'time-a',status:'running',durationSeconds:300,remainingSeconds:111,startedAt:timestamp,expiresAt:new Date(clock+111_000).toISOString(),updatedAt:timestamp,endedAt:null},
    'time-b':{testletKey:'time-b',status:'paused',durationSeconds:300,remainingSeconds:61,startedAt:timestamp,expiresAt:null,updatedAt:timestamp,endedAt:null}}};await repository.saveTestRun(original);
   const paused=await invoke(input('pause'));assert.equal(paused.testRun.testletTimers['time-a'].remainingSeconds,111);
   clock+=3_000;const resumed=await invoke(input('resume',[],{controllerStatus:'PAUSED'}));assert.equal(resumed.testRun.status,'running');assert.equal(resumed.testRun.testletTimers['time-a'].remainingSeconds,111);
   assert.deepEqual(resumed.testRun.testletTimers['time-b'],original.testletTimers['time-b']);preserve(resumed.testRun,original);await repository.saveTestRun(run);
  });
  await t.test('resume applies the Original entry guard without clearing locks, inventing a Unit or changing answers',async()=>{
   for(const [currentUnitKey,lockedUnitKeys,expected] of [
    ['unit',['unit','alias-Ω'],'timed-a'],['alias-Ω',[],'timed-a'],
    ['unit',[],'unit'],['timed-b',['timed-b'],'timed-b'],[null,[],null]
   ]){
    const original={...run,status:'paused',pauseSource:'participant',currentUnitKey,lockedUnitKeys};await repository.saveTestRun(original);
    const request=input('resume',[],{controllerStatus:'PAUSED'}),before=await snapshot(request),result=await invoke(request);
    assert.equal(result.testRun.currentUnitKey,expected);assert.equal(result.testRun.status,'running');preserve(result.testRun,original);
    for(const key of ['lockedUnitKeys','lockedTestletKeys','unlockedTestletKeys'])assert.deepEqual(result.testRun[key],original[key],key);
    if(expected===null)assert.deepEqual(result.testRun.testletTimers,{});
    const after=await snapshot(request,await create());assert.deepEqual(after.commands,before.commands);assert.deepEqual(after.sibling,before.sibling);assert.deepEqual(after.foreign,before.foreign);
    assert.equal((await invoke(request,await create())).applied,false);assert.deepEqual(await snapshot(request,await create()),after);
   }
   await repository.saveTestRun(run);
  });
  await t.test('resume skips an expired or hidden timed block and starts only the accessible target countdown',async()=>{
   const release=await repository.getContentReleaseById(releaseId);
   for(const hidden of [false,true]){
    const timer={testletKey:'time-a',status:hidden?'paused':'expired',durationSeconds:300,remainingSeconds:hidden?71:0,startedAt:timestamp,expiresAt:null,updatedAt:timestamp,endedAt:hidden?null:timestamp};
    const original={...run,status:'paused',pauseSource:'participant',currentUnitKey:'timed-a',testletTimers:{'time-a':timer}};
    if(hidden){const changed=structuredClone(release);changed.runtimeSnapshot.bookletEntries[0].testletEntries.find(entry=>entry.testletKey==='time-a').restrictions.show={stateKey:'unselected',optionKey:'hidden'};await repository.saveContentRelease(changed);}
    await repository.saveTestRun(original);const result=await invoke(input('resume',[],{controllerStatus:'PAUSED'}));
    assert.equal(result.testRun.currentUnitKey,'timed-b');assert.equal(result.testRun.testletTimers['time-a'].status,timer.status);
    assert.equal(result.testRun.testletTimers['time-a'].remainingSeconds,timer.remainingSeconds);assert.equal(result.testRun.testletTimers['time-a'].expiresAt,null);
    assert.equal(result.testRun.testletTimers['time-b'].status,'running');assert.equal(result.testRun.testletTimers['time-b'].remainingSeconds,300);
    preserve(result.testRun,original);await repository.saveContentRelease(release);
   }
   await repository.saveTestRun(run);
  });
  await t.test('goto resolves exact aliases or sequences and clears only the immediate parent and target Unit locks',async()=>{
   for(const args of [['2'],['id','alias-Ω']]){await repository.saveTestRun(run);const result=await invoke(input('goto',args));assert.equal(result.testRun.currentUnitKey,'alias-Ω');
    assert.deepEqual(result.testRun.unlockedTestletKeys,['inner']);assert.deepEqual(result.testRun.lockedTestletKeys,[]);assert.deepEqual(result.testRun.lockedUnitKeys,[]);preserve(result.testRun,run);}
   await repository.saveTestRun(run);
  });
  await t.test('cross-timer goto restores closed immediate-parent minutes but preserves a positive target balance',async()=>{
   const original={...run,currentUnitKey:'timed-a',testletTimers:{'time-a':{testletKey:'time-a',status:'running',durationSeconds:300,remainingSeconds:90,startedAt:timestamp,expiresAt:new Date(clock+90_000).toISOString(),updatedAt:timestamp,endedAt:null},
    'time-b':{testletKey:'time-b',status:'expired',durationSeconds:300,remainingSeconds:0,startedAt:timestamp,expiresAt:null,updatedAt:timestamp,endedAt:timestamp}}};
   await repository.saveTestRun(original);const result=await invoke(input('goto',['id','timed-b','give 2']));assert.equal(result.testRun.currentUnitKey,'timed-b');assert.equal(result.testRun.testletTimers['time-a'].status,'cancelled');assert.equal(result.testRun.testletTimers['time-b'].remainingSeconds,120);preserve(result.testRun,original);
   await repository.saveTestRun({...original,testletTimers:{...original.testletTimers,'time-b':{...original.testletTimers['time-b'],status:'paused',remainingSeconds:61,endedAt:null}}});
   assert.equal((await invoke(input('goto',['id','timed-b','give 2']))).testRun.testletTimers['time-b'].remainingSeconds,61);await repository.saveTestRun(run);
  });
  await t.test('termination returns to Starter with exact lowercase lock semantics and retained answers',async()=>{
   for(const args of [[],['LOCK'],['lock','Exact Ω']]){await repository.saveTestRun({...run,status:'paused',pauseSource:'monitor'});const request=input('terminate',args,{controllerStatus:'PAUSED'}),result=await invoke(request);
    assert.equal(result.testRun.status,'paused');assert.equal(result.testRun.locked,args.includes('lock'));assert.equal(result.testRun.completedAt,null);assert.equal(result.participantSession.status,'signed_in');preserve(result.testRun,run);
    const logs=await repository.listParticipantTestLogsByWorkspace(base.tenantId,base.workspaceId);assert.equal(logs.filter(log=>log.participantTestLogId.startsWith(`delivery:${run.testRunId}:console:${request.deliveryId}:`)&&log.logKey==='command executed')[0].logContent,['terminate',...args].join(' '));}
   await repository.saveTestRun(run);await repository.saveParticipantSession(parent);
  });
  await t.test('foreign scope, corrupted release, malformed arguments and immutable receipt substitutions make no writes',async()=>{
   const before=await snapshot();for(const extra of [{testRunId:foreign.testRunId},{contentReleaseId:'foreign'},{bookletKey:'foreign'},{keyword:'debug'},{arguments:[42]},{arguments:null},{timeStamp:NaN},{controllerStatus:'TERMINATED'},{deliveryId:'bad/id'}]){
    await assert.rejects(invoke(input('pause',[],extra)));assert.deepEqual(await snapshot(),before);}
   for(const args of [[],['0'],['id','original-not-alias'],['id','missing'],['3']]){await assert.rejects(invoke(input('goto',args)));assert.deepEqual(await snapshot(),before);}
   const request=input('pause'),accepted=await invoke(request),after=await snapshot(request);assert.equal(accepted.applied,true);
   for(const extra of [{keyword:'resume'},{arguments:['different']},{controllerStatus:'ERROR'},{timeStamp:request.timeStamp+1}]){
    await assert.rejects(invoke({...request,...extra}),error=>error.errorCode==='participant_delivery_conflict');assert.deepEqual(await snapshot(request),after);}
   await repository.saveTestRun(run);
  });
  if(kind!=='memory')await t.test('failed native command log rolls back Run, parent, audit and receipt; a restarted retry commits once',async()=>{
   await repository.saveTestRun(run);await repository.saveParticipantSession(parent);const request=input('terminate',['lock']),before=await snapshot(request),backup=join(directory,'backup.json');
   if(kind==='file'){await rename(file,backup);await mkdir(file);}else if(kind==='sqlite')control.exec("CREATE TRIGGER owned_native_failure BEFORE INSERT ON participant_test_logs WHEN NEW.log_key='command executed' BEGIN SELECT RAISE(ABORT,'owned native failure'); END");
   else await control.query("CREATE FUNCTION owned_native_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned native failure'; END $$; CREATE TRIGGER owned_native_failure BEFORE INSERT ON participant_test_logs FOR EACH ROW WHEN (NEW.log_key='command executed') EXECUTE FUNCTION owned_native_failure()");
   try{await assert.rejects(invoke(request));if(kind!=='file')assert.deepEqual(await snapshot(request),before);}
   finally{if(kind==='file'){await rm(file,{recursive:true});await rename(backup,file);}else if(kind==='sqlite')control.exec('DROP TRIGGER owned_native_failure');else await control.query('DROP TRIGGER owned_native_failure ON participant_test_logs; DROP FUNCTION owned_native_failure()');}
   assert.deepEqual(await snapshot(request),before);assert.equal((await invoke(request,await create())).applied,true);const after=await snapshot(request,await create());
   assert.equal((await invoke(request,await create())).applied,false);assert.deepEqual(await snapshot(request,await create()),after);
  });
 }finally{for(const storage of storages)await storage.shutdown();if(kind==='sqlite')control?.close();else await control?.end();try{if(created)await root.query(`DROP SCHEMA "${schema}" CASCADE`);}finally{await root?.end();await rm(directory,{recursive:true,force:true});}}
});
