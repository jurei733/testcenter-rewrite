import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Pool} from 'pg';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {compileBookletRuntimePolicy} from '@testcenter-rewrite-app/contracts';
import {participantExecutionModeDefinitions} from '@testcenter-rewrite-app/domain';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceRepository} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceRepository} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';

const kinds=['memory','file','sqlite'];
if(process.env.FIRST_SLICE_STORE==='postgres'){assert.ok(process.env.FIRST_SLICE_POSTGRES_URL);kinds.push('postgres');}
for(const kind of kinds)test(`${kind}: controller timer reentry distinguishes interrupted zero, expiry and other paused blocks`,async t=>{
 const directory=await mkdtemp(join(tmpdir(),'testcenter-timer-resume-')),file=join(directory,kind==='file'?'owned.json':'owned.sqlite');
 const schema='owned_timer_resume_'+randomUUID().replaceAll('-',''),url=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;
 url?.searchParams.set('options','-c search_path='+schema);const root=kind==='postgres'?new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL}):null;
 let repository,storage,created=false,clock=Date.parse('2026-10-13T00:00:00.000Z');
 const now=()=>new Date(clock).toISOString(),fresh=async()=>kind==='memory'?repository:kind==='file'?createFileFirstSliceRepository(file):kind==='sqlite'?createSqliteFirstSliceRepository(file):(storage??=await createPostgresFirstSliceStorage(url.toString())).repository;
 const service=()=>createFirstSliceServices({repository,now,xmlSchemaProfile:'legacy-compatibility'});
 try{
  if(root){await root.query(`CREATE SCHEMA "${schema}"`);created=true;}
  repository=kind==='memory'?createInMemoryFirstSliceRepository():await fresh();
  const tenant=await service().platform.createTenant({tenantKey:'timer-resume-'+randomUUID(),displayName:'Owned timer resume'});
  const workspace=await service().platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'owned',displayName:'Owned timer resume'});
  const scope={tenantId:tenant.tenantId,workspaceId:workspace.workspaceId},releaseId=randomUUID(),createdAt=now();
  const booklet={bookletKey:'owned',displayLabel:'Owned',policy:compileBookletRuntimePolicy({}),testletEntries:[
   {testletKey:'timed',displayLabel:'Timed',parentTestletKey:null,restrictions:{timeMax:{minutes:0.1,leave:'confirm'}}},
   {testletKey:'other',displayLabel:'Other',parentTestletKey:null,restrictions:{timeMax:{minutes:0.1,leave:'confirm'}}}],
   unitEntries:[{unitKey:'first',displayLabel:'First',testletPath:['timed']},{unitKey:'after',displayLabel:'After',testletPath:[]},{unitKey:'other-unit',displayLabel:'Other',testletPath:['other']}]};
  const release={...scope,contentReleaseId:releaseId,importJobId:releaseId,releaseLabel:'Owned',status:'active',createdAt,activatedAt:createdAt,runtimeSnapshot:{bookletEntries:[booklet,{bookletKey:'sibling',displayLabel:'Sibling',policy:compileBookletRuntimePolicy({}),unitEntries:[{unitKey:'first',displayLabel:'Sibling',testletPath:[]}]}]}};
  await repository.saveContentRelease(release);
  await service().workspaceAdminRead.importParticipantRoster({tenantKey:tenant.tenantKey,workspaceKey:workspace.workspaceKey,
   rosterText:'<Testtakers><Group id="owned"><Login mode="run-hot-return" name="owned"><Booklet>owned</Booklet><Booklet>sibling</Booklet></Login></Group></Testtakers>'});
  const parent={...scope,participantSessionId:randomUUID(),contentReleaseId:releaseId,loginKey:'owned',groupKey:'owned',executionMode:'run-hot-return',status:'launched',createdAt};await repository.saveParticipantSession(parent);
  const base={...scope,testRunId:randomUUID(),participantSessionId:parent.participantSessionId,contentReleaseId:releaseId,bookletKey:'owned',bookletAssignmentKey:'owned',executionMode:'run-hot-return',status:'running',currentUnitKey:'first',
   unitResponses:{first:'Exact Ä/β\n"; answer'},unitResponseFieldTimestamps:{first:{opaque:123}},sharedParameters:[{key:'owned',value:'Exact'}],sharedParameterTimestamps:{owned:125},createdAt,updatedAt:createdAt,completedAt:null,controllerEntry:{active:true,revision:1}};
  const sibling={...base,testRunId:randomUUID(),bookletKey:'sibling',bookletAssignmentKey:'sibling',unitResponses:{first:'Protected sibling'},testletTimers:{}};await repository.saveTestRun(sibling);const siblingBefore=await repository.getTestRunById(sibling.testRunId);
  let sequence=0;
  const command=async(keyword,origin)=>{
   const current=await repository.getTestRunById(base.testRunId),controllerDispatch={controllerId:'owned-timer-resume',sequence:++sequence};
   if(origin==='native'){
    const request={participantSessionId:parent.participantSessionId,testRunId:base.testRunId,contentReleaseId:releaseId,bookletKey:'owned',deliveryId:randomUUID(),keyword,arguments:[],controllerStatus:keyword==='resume'?'PAUSED':'RUNNING',timeStamp:clock,controllerDispatch};
    const result=await service().participantRuntime.executeNativeCommand(request);return {result,replay:()=>service().participantRuntime.executeNativeCommand(request)};
   }
   const queued=await repository.appendParticipantRunCommand({...current,commandId:randomUUID(),commandType:keyword,actorId:null,targetUnitKey:null,remainingSeconds:null,effectsDeferred:true,issuedAt:now()});assert.ok(queued);
   const input={participantSessionId:parent.participantSessionId,testRunId:base.testRunId,commandId:queued.commandId,controllerStatus:keyword==='resume'?'PAUSED':'RUNNING',controllerDispatch};
   await service().participantRuntime.acknowledgeCommand(input);
   const result=await service().participantRuntime.executeCommand(input);return {result,replay:()=>service().participantRuntime.executeCommand(input)};
  };
  const timer=(status,seconds)=>({testletKey:'timed',status,durationSeconds:6,remainingSeconds:seconds,startedAt:createdAt,expiresAt:status==='running'?new Date(clock+6000).toISOString():null,updatedAt:now(),endedAt:['expired','cancelled'].includes(status)?now():null});
  const other={...timer('paused',2),testletKey:'other',interruptedAtUnitKey:'other-unit'};
  const preserve=async(result)=>{
   for(const key of ['unitResponses','unitResponseFieldTimestamps','sharedParameters','sharedParameterTimestamps','createdAt','bookletAssignmentKey'])assert.deepEqual(result[key],base[key],key);
   assert.deepEqual(result.testletTimers.other,other);assert.deepEqual(await repository.getTestRunById(sibling.testRunId),siblingBefore);
  };
  for(const mode of Object.keys(participantExecutionModeDefinitions)){
   const origins=participantExecutionModeDefinitions[mode].receiveRemoteCommands?['native','remote']:['native'];
   for(const origin of origins){
    await t.test(`${mode}/${origin}: a zero STEP interruption restarts the authored duration without reviving another timer`,async()=>{
     sequence=0;const running={...base,executionMode:mode,testletTimers:{timed:timer('running',6),other}};await repository.saveTestRun(running);await repository.saveParticipantSession(parent);
     clock+=5500;
     const preparation={participantSessionId:parent.participantSessionId,testRunId:base.testRunId,contentReleaseId:releaseId,bookletKey:'owned',deliveryId:randomUUID(),keyword:'pause',controllerStatus:'RUNNING',
      controllerDispatch:{controllerId:'owned-timer-resume',sequence:++sequence},unitKey:'first',testletKey:'timed',startedAt:createdAt,expiresAt:running.testletTimers.timed.expiresAt,remainingSeconds:0};
     await service().participantRuntime.interruptControllerTimer(preparation);clock+=2000;
     const held=await service().participantRuntime.getCurrentRunState({participantSessionId:parent.participantSessionId,testRunId:base.testRunId});
     assert.equal(held.testRun.currentUnitKey,'first');assert.equal(held.testRun.testletTimers.timed.remainingSeconds,0);assert.equal(held.testRun.testletTimers.timed.status,'paused');assert.equal(held.currentUnit.parentLocked,false);
     await command('pause',origin);clock+=100;
     const {result,replay}=await command('resume',origin),resumed=result.testRun;
     assert.equal(resumed.status,'running');assert.equal(resumed.currentUnitKey,'first');assert.equal(resumed.testletTimers.timed.status,'running');assert.equal(resumed.testletTimers.timed.remainingSeconds,6);
     const executedAt=result.executedAt??result.command.executedAt;
     assert.equal(resumed.testletTimers.timed.expiresAt,new Date(Date.parse(executedAt)+6000).toISOString());assert.equal(resumed.testletTimers.timed.interruptedAtUnitKey,undefined);await preserve(resumed);
     const saved=JSON.parse(JSON.stringify(await repository.getTestRunById(base.testRunId)));clock+=2000;
     if(kind==='postgres'){await storage.shutdown();storage=undefined;}
     repository=await fresh();const beforeReplay=await repository.getTestRunById(base.testRunId);
     assert.deepEqual(JSON.parse(JSON.stringify(beforeReplay)),saved);assert.equal((await replay()).applied,false);assert.deepEqual(await repository.getTestRunById(base.testRunId),beforeReplay);
    });
    await t.test(`${mode}/${origin}: real expiry preserves the enforced lock and permits explicit preview reentry`,async()=>{
     sequence=0;const closed=timer('expired',0),original={...base,executionMode:mode,status:'paused',pauseSource:origin==='remote'?'monitor':'participant',testletTimers:{timed:closed,other}};await repository.saveTestRun(original);await repository.saveParticipantSession(parent);
     const {result}=await command('resume',origin),resumed=result.testRun;
     if(participantExecutionModeDefinitions[mode].forceTimeRestrictions){assert.equal(resumed.currentUnitKey,'after');assert.deepEqual(resumed.testletTimers.timed,closed);}
     else{assert.equal(resumed.currentUnitKey,'first');assert.equal(resumed.testletTimers.timed.status,'running');assert.equal(resumed.testletTimers.timed.remainingSeconds,6);}
     await preserve(resumed);
    });
   }
  }
  for(const mode of Object.keys(participantExecutionModeDefinitions))for(const keyword of ['pause','terminate'])for(const elapsed of [2500,5500]){
   await t.test(`${mode}/${keyword}/${elapsed}: a proven earlier legacy retime can be interrupted from a stale same-Unit snapshot`,async()=>{
    const original={...base,executionMode:mode,testletTimers:{timed:timer('running',6),other}};await repository.saveTestRun(original);await repository.saveParticipantSession(parent);clock+=elapsed;
    const legacy={testRunId:base.testRunId,contentReleaseId:releaseId,bookletKey:'owned',deliveryId:randomUUID(),keyword:'goto',arguments:['id','first','give 0'],controllerStatus:'RUNNING',timeStamp:clock};
    await service().participantRuntime.executeNativeCommand({...legacy,participantSessionId:parent.participantSessionId});
    const committed=await repository.getTestRunById(base.testRunId);assert.ok(committed.testletTimers.timed.legacyPreparation);assert.notEqual(committed.testletTimers.timed.expiresAt,original.testletTimers.timed.expiresAt);clock+=1250;
    if(kind==='postgres'){await storage.shutdown();storage=undefined;}repository=await fresh();
    const request={participantSessionId:parent.participantSessionId,testRunId:base.testRunId,contentReleaseId:releaseId,bookletKey:'owned',deliveryId:randomUUID(),keyword,controllerStatus:'RUNNING',controllerDispatch:{controllerId:'owned-legacy-rebase',sequence:1},unitKey:'first',testletKey:'timed',startedAt:original.testletTimers.timed.startedAt,expiresAt:original.testletTimers.timed.expiresAt,remainingSeconds:Math.max(0,Math.floor((Date.parse(original.testletTimers.timed.expiresAt)-clock)/1000)),legacyCommand:legacy,observedAt:clock};
    const expected=Math.max(0,Math.ceil((Date.parse(committed.testletTimers.timed.expiresAt)-clock)/1000)-1);assert.equal(expected,elapsed===2500?1:4);
    await service().participantRuntime.interruptControllerTimer(request);
    const paused=await repository.getTestRunById(base.testRunId);assert.equal(paused.status,'running');assert.equal(paused.currentUnitKey,'first');assert.equal(paused.testletTimers.timed.status,'paused');assert.equal(paused.testletTimers.timed.remainingSeconds,expected);assert.equal(paused.testletTimers.timed.legacyPreparation,undefined);assert.equal(paused.controllerDispatches?.['owned-legacy-rebase']??0,0);await preserve(paused);
    clock+=7000;const held=await service().participantRuntime.getCurrentRunState({participantSessionId:parent.participantSessionId,testRunId:base.testRunId});assert.equal(held.testRun.currentUnitKey,'first');assert.equal(held.testRun.testletTimers.timed.remainingSeconds,expected);
    if(kind==='postgres'){await storage.shutdown();storage=undefined;}repository=await fresh();const beforeReplay=await repository.getTestRunById(base.testRunId);
    assert.equal((await service().participantRuntime.interruptControllerTimer(request)).applied,false);assert.deepEqual(await repository.getTestRunById(base.testRunId),beforeReplay);
    assert.equal((await service().participantRuntime.executeNativeCommand({...legacy,participantSessionId:parent.participantSessionId})).applied,false);assert.deepEqual(await repository.getTestRunById(base.testRunId),beforeReplay);
    const final=await service().participantRuntime.executeNativeCommand({participantSessionId:parent.participantSessionId,testRunId:base.testRunId,contentReleaseId:releaseId,bookletKey:'owned',deliveryId:request.deliveryId,keyword,arguments:[],controllerStatus:'RUNNING',timeStamp:request.observedAt,controllerDispatch:{controllerId:'owned-legacy-rebase',sequence:keyword==='terminate'?2:1}});
    assert.equal(final.testRun.status,'paused');assert.equal(final.testRun.testletTimers.timed.remainingSeconds,expected);await preserve(final.testRun);
   });
  }
  await t.test('legacy causality cannot freeze a later timer, another Unit, a forged packet or an ambiguous clock',async()=>{
   for(const change of ['missing-context','wrong-id','wrong-payload','wrong-before','future-observation','earlier-observation','ended-observation','later-timer','later-unit','later-dispatch','wrong-scope','newer-legacy']){
    const original={...base,testletTimers:{timed:timer('running',6),other}};await repository.saveTestRun(original);await repository.saveParticipantSession(parent);clock+=2500;
    const legacy={testRunId:base.testRunId,contentReleaseId:releaseId,bookletKey:'owned',deliveryId:randomUUID(),keyword:'goto',arguments:['id','first','give 0'],controllerStatus:'RUNNING',timeStamp:clock};
    await service().participantRuntime.executeNativeCommand({...legacy,participantSessionId:parent.participantSessionId});clock+=750;
    let current=await repository.getTestRunById(base.testRunId);
    const request={participantSessionId:parent.participantSessionId,testRunId:base.testRunId,contentReleaseId:releaseId,bookletKey:'owned',deliveryId:randomUUID(),keyword:'pause',controllerStatus:'RUNNING',controllerDispatch:{controllerId:'owned-legacy-rebase',sequence:1},unitKey:'first',testletKey:'timed',startedAt:original.testletTimers.timed.startedAt,expiresAt:original.testletTimers.timed.expiresAt,remainingSeconds:2,legacyCommand:structuredClone(legacy),observedAt:clock};
    if(change==='missing-context'){delete request.legacyCommand;delete request.observedAt;}
    if(change==='wrong-id')request.legacyCommand.deliveryId=randomUUID();
    if(change==='wrong-payload')request.legacyCommand.arguments.push('different');
    if(change==='wrong-before')request.expiresAt=new Date(Date.parse(request.expiresAt)-1000).toISOString();
    if(change==='future-observation')request.observedAt=clock+1000;
    if(change==='earlier-observation')request.observedAt=Date.parse(current.testletTimers.timed.updatedAt)-1;
    if(change==='ended-observation'){request.observedAt=Date.parse(current.testletTimers.timed.expiresAt);clock=request.observedAt+100;}
    if(change==='later-timer')current.testletTimers.timed.expiresAt=new Date(Date.parse(current.testletTimers.timed.expiresAt)+1000).toISOString();
    if(change==='later-unit')current.currentUnitKey='after';
    if(change==='later-dispatch')current.controllerDispatches={'owned-legacy-rebase':2};
    if(change==='wrong-scope')current.testletTimers.timed.legacyPreparation.scope.workspaceId='other';
    if(change==='newer-legacy'){await service().participantRuntime.executeNativeCommand({...legacy,deliveryId:randomUUID(),timeStamp:clock,participantSessionId:parent.participantSessionId});current=await repository.getTestRunById(base.testRunId);}
    await repository.saveTestRun(current);await service().participantRuntime.interruptControllerTimer(request);
    const after=await repository.getTestRunById(base.testRunId);assert.deepEqual(after.testletTimers,current.testletTimers,change);assert.equal(after.currentUnitKey,current.currentUnitKey);await preserve(after);
   }
  });
  await t.test('malformed legacy preparation context is rejected without changing its Run',async()=>{
   const original={...base,testletTimers:{timed:timer('running',6),other}};await repository.saveTestRun(original);await repository.saveParticipantSession(parent);
   const legacy={testRunId:base.testRunId,contentReleaseId:releaseId,bookletKey:'owned',deliveryId:randomUUID(),keyword:'goto',arguments:['id','first'],controllerStatus:'RUNNING',timeStamp:clock};
   const request={participantSessionId:parent.participantSessionId,testRunId:base.testRunId,contentReleaseId:releaseId,bookletKey:'owned',deliveryId:randomUUID(),keyword:'pause',controllerStatus:'RUNNING',controllerDispatch:{controllerId:'owned-legacy-rebase',sequence:1},unitKey:'first',testletKey:'timed',startedAt:createdAt,expiresAt:original.testletTimers.timed.expiresAt,remainingSeconds:3,legacyCommand:legacy,observedAt:clock};
   for(const invalid of [{...request,observedAt:undefined},{...request,legacyCommand:undefined},{...request,legacyCommand:{...legacy,testRunId:'other'}},{...request,legacyCommand:{...legacy,controllerDispatch:{controllerId:'other',sequence:1}}}]){
    const before=await repository.getTestRunById(base.testRunId);await assert.rejects(service().participantRuntime.interruptControllerTimer(invalid),error=>error.errorCode==='participant_controller_timer_interruption_invalid');assert.deepEqual(await repository.getTestRunById(base.testRunId),before);
   }
  });
  await t.test('ordinary Run and saving-session resume also restore an interrupted zero timer without touching a sibling',async()=>{
   for(const entry of ['run','session']){
    const original={...base,status:'paused',pauseSource:'participant',testletTimers:{timed:{...timer('paused',0),interruptedAtUnitKey:'first'},other}};await repository.saveTestRun(original);await repository.saveParticipantSession(parent);
    const resumed=entry==='run'?await service().participantRuntime.resumeRun({testRunId:base.testRunId}):await service().participantRuntime.resumeSession({participantSessionId:parent.participantSessionId,bookletKey:'owned',controllerLifecycle:'browser-v1'});
    assert.equal(resumed.testRunId,base.testRunId);assert.equal(resumed.currentUnitKey,'first');assert.equal(resumed.testletTimers.timed.status,'running');assert.equal(resumed.testletTimers.timed.remainingSeconds,6);await preserve(resumed);
   }
  });
  await t.test('all Resume entry paths skip a leave-locked current Unit without restarting its timer',async()=>{
   for(const entry of ['native','remote','run','session']){
    sequence=0;
    const paused={...timer('paused',2),interruptedAtUnitKey:'first'};
    await repository.saveTestRun({...base,status:'paused',pauseSource:'participant',lockedUnitKeys:['first'],testletTimers:{timed:paused,other}});await repository.saveParticipantSession(parent);
    const resumed=entry==='run'?await service().participantRuntime.resumeRun({testRunId:base.testRunId}):entry==='session'?await service().participantRuntime.resumeSession({participantSessionId:parent.participantSessionId,bookletKey:'owned',controllerLifecycle:'browser-v1'}):(await command('resume',entry)).result.testRun;
    assert.equal(resumed.status,'running');assert.equal(resumed.currentUnitKey,'after');assert.deepEqual({...resumed.testletTimers.timed,updatedAt:paused.updatedAt},paused);assert.ok(Date.parse(resumed.testletTimers.timed.updatedAt)>=Date.parse(paused.updatedAt));await preserve(resumed);
   }
  });
  await t.test('a code-first activation remains accessible but cannot start its locked parent timer',async()=>{
   sequence=0;const changed=structuredClone(release);changed.runtimeSnapshot.bookletEntries[0].testletEntries[0].restrictions.codeToEnter={code:'OWNED',prompt:'Owned'};await repository.saveContentRelease(changed);
   for(const origin of ['native','remote']){
    const original={...base,status:'paused',testletTimers:{other}};await repository.saveTestRun(original);await repository.saveParticipantSession(parent);
    const {result}=await command('resume',origin);assert.equal(result.testRun.currentUnitKey,'first');assert.equal(result.testRun.testletTimers.timed,undefined);await preserve(result.testRun);
    const current=await service().participantRuntime.getCurrentRunState({participantSessionId:parent.participantSessionId,testRunId:base.testRunId});assert.equal(current.currentUnit.parentLocked,true);assert.equal(current.testRun.testletTimers.timed,undefined);
    assert.equal(current.navigation.nextTestletGate?.testletKey,'timed');
    const before=await repository.getTestRunById(base.testRunId);
    await assert.rejects(service().participantRuntime.unlockTestlet({testRunId:base.testRunId,testletKey:'timed',code:'wrong'}),error=>error.errorCode==='testlet_unlock_code_invalid');
    assert.deepEqual(await repository.getTestRunById(base.testRunId),before);
    const unlocked=await service().participantRuntime.unlockTestlet({testRunId:base.testRunId,testletKey:'timed',code:'oWnEd'});
    assert.equal(unlocked.currentUnitKey,'first');assert.equal(unlocked.testletTimers.timed.status,'running');assert.equal(unlocked.testletTimers.timed.remainingSeconds,6);await preserve(unlocked);
   }
   await repository.saveContentRelease(release);
  });
 }finally{await storage?.shutdown();if(created)await root.query(`DROP SCHEMA "${schema}" CASCADE`);await root?.end();await rm(directory,{recursive:true,force:true});}
});
