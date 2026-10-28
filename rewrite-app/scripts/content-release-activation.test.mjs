import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm,rename,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {Pool} from 'pg';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceRepository} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
const stamp='2026-10-22T12:00:00.000Z',activatedAt='2026-10-22T12:01:00.000Z',clone=value=>structuredClone(value);
const kinds=['memory','file','sqlite',...(process.env.FIRST_SLICE_STORE==='postgres'?['postgres']:[])];
for(const kind of kinds)test(kind+': release activation and its audit use one captured workspace transaction',async t=>{
 const folder=await mkdtemp(join(tmpdir(),'owned-content-activation-')),file=join(folder,kind==='sqlite'?'owned.sqlite':'owned.json');
 const schema='owned_activation_'+randomUUID().replaceAll('-',''),storages=[];
 const url=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;url?.searchParams.set('options','-c search_path='+schema);
 let repository,control,rootPool;
 const create=async(connection=url)=>{
  if(kind==='memory')return repository??createInMemoryFirstSliceRepository();if(kind==='file')return createFileFirstSliceRepository(file);
  const storage=kind==='sqlite'?createSqliteFirstSliceStorage(file):await createPostgresFirstSliceStorage(connection.toString());storages.push(storage);return storage.repository;
 };
 const snapshot=async(f,repo=repository)=>{
  const result=clone({releases:await repo.listContentReleasesByWorkspace(f.tenantId,f.workspaceId),events:await repo.listWorkspaceActivityEventsByWorkspace(f.tenantId,f.workspaceId),
   sessions:await repo.listParticipantSessionsByWorkspace(f.tenantId,f.workspaceId),runs:await repo.listTestRunsByWorkspace(f.tenantId,f.workspaceId)});
  const keys={releases:'contentReleaseId',events:'activityEventId',sessions:'participantSessionId',runs:'testRunId'};
  for(const [name,rows] of Object.entries(result))rows.sort((a,b)=>a[keys[name]].localeCompare(b[keys[name]]));return result;
 };
 const fixture=async()=>{
  const id=randomUUID(),scope={tenantId:id,workspaceId:id};
  await repository.saveTenant({tenantId:id,tenantKey:id,displayName:'Owned',status:'active',createdAt:stamp});
  await repository.saveWorkspace({tenantKey:id,workspaceKey:id,workspace:{...scope,workspaceKey:id,displayName:'Owned',status:'active',createdAt:stamp}});
  const release={...scope,contentReleaseId:id,importJobId:id,releaseLabel:'Old',status:'active',createdAt:stamp,activatedAt:stamp,
   runtimeSnapshot:{bookletEntries:[{bookletKey:'owned',displayLabel:'Owned',unitEntries:[{unitKey:'unit',displayLabel:'Unit',unitDefinition:'Exact old definition Ω'}]}]}};
  await repository.saveContentRelease(release);
  const target={...release,contentReleaseId:randomUUID(),status:'staged',activatedAt:null,releaseLabel:'Next',runtimeSnapshot:{bookletEntries:[]}};
  await repository.saveContentRelease(target);
  const session={...scope,participantSessionId:id,contentReleaseId:id,loginKey:id,groupKey:id,status:'launched',createdAt:stamp};await repository.saveParticipantSession(session);
  await repository.saveTestRun({...scope,testRunId:id,participantSessionId:id,contentReleaseId:id,bookletKey:'owned',status:'paused',currentUnitKey:'unit',
   unitResponses:{unit:' Exact saved answer Ω\n'},testletTimers:{},createdAt:stamp,updatedAt:stamp,completedAt:null});
  const expectedRevision=await repository.getContentReleaseActivationRevision(id,id);
  const candidate=()=>({...scope,contentReleaseId:target.contentReleaseId,activatedAt,expectedRevision,activityEvent:{...scope,activityEventId:randomUUID(),eventType:'content_release_activated',
   subjectType:'content_release',subjectId:target.contentReleaseId,actorId:'owned',occurredAt:activatedAt,summary:'Owned activation',details:{previousActiveContentReleaseId:id}}});
  return{...scope,release,target,session,candidate};
 };
 try{
  if(url){rootPool=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await rootPool.query('CREATE SCHEMA "'+schema+'"');control=new Pool({connectionString:url.toString()});}
  repository=await create();if(kind==='sqlite')control=new DatabaseSync(file);
  await t.test('activation commits both release statuses and one audit without changing immutable content or participant data',async()=>{
   const f=await fixture(),before=await snapshot(f),input=f.candidate();assert.equal(await repository.commitContentReleaseActivation(input),true);
   const after=await snapshot(f);assert.deepEqual(after.releases.find(row=>row.contentReleaseId===f.release.contentReleaseId),{...f.release,status:'superseded'});
   assert.deepEqual(after.releases.find(row=>row.contentReleaseId===f.target.contentReleaseId),{...f.target,status:'active',activatedAt});
   assert.deepEqual(after.events,[input.activityEvent]);assert.deepEqual(after.sessions,before.sessions);assert.deepEqual(after.runs,before.runs);
   assert.equal(await repository.commitContentReleaseActivation(input),false);assert.deepEqual(await snapshot(f),after);
   if(kind!=='memory')assert.deepEqual(await snapshot(f,await create()),after);
  });
  await t.test('intervening release, session and new-run writes invalidate the captured activation',async()=>{
   for(const change of ['release','session','new-run']){
    const f=await fixture(),input=f.candidate();
    if(change==='release')await repository.saveContentRelease({...f.target,releaseLabel:'Newer label'});
    if(change==='session')await repository.saveParticipantSession({...f.session,groupKey:'Changed group'});
    if(change==='new-run'){const run=await repository.getTestRunById(f.session.participantSessionId);await repository.saveTestRun({...run,testRunId:randomUUID(),bookletKey:'other'});}
    const before=await snapshot(f);assert.equal(await repository.commitContentReleaseActivation(input),false);assert.deepEqual(await snapshot(f),before);
   }
  });
  await t.test('the real use case rejects a stale open-run check and never calls the old separate write methods',async()=>{
   const f=await fixture();let writes=0;
   const completed={...await repository.getTestRunById(f.tenantId),status:'completed',completedAt:stamp};await repository.saveTestRun(completed);
   const guarded={...repository,saveContentRelease:()=>assert.fail('Activation must commit through the atomic port.'),
    async commitContentReleaseActivation(input){writes++;const run=await repository.getTestRunById(f.tenantId);await repository.saveTestRun({...run,testRunId:randomUUID(),status:'paused',completedAt:null});return repository.commitContentReleaseActivation(input);}};
   const service=createFirstSliceServices({repository:guarded,now:()=>activatedAt});
   await assert.rejects(service.contentIntake.activateContentRelease({tenantKey:f.tenantId,workspaceKey:f.workspaceId,contentReleaseId:f.target.contentReleaseId,activatedByActorId:'owned'}),error=>error.errorCode==='content_release_activation_conflict');
   assert.equal(writes,1);assert.deepEqual(await repository.getContentReleaseById(f.release.contentReleaseId),f.release);assert.deepEqual(await repository.getContentReleaseById(f.target.contentReleaseId),f.target);
   assert.deepEqual(await repository.listWorkspaceActivityEventsByWorkspace(f.tenantId,f.workspaceId),[]);
  });
  await t.test('answer and clock autosaves remain independent and activation preserves their exact committed bytes',async()=>{
   const f=await fixture(),input=f.candidate(),run=await repository.getTestRunById(f.tenantId);
   await repository.saveTestRun({...run,unitResponses:{unit:' New autosave Ω\n  '},updatedAt:activatedAt,
    testletTimers:{owned:{testletKey:'owned',status:'paused',remainingSeconds:17,durationSeconds:300,updatedAt:activatedAt,startedAt:stamp,endedAt:null,expiresAt:null}}});
   const before=await snapshot(f);
   assert.equal(await repository.commitContentReleaseActivation(input),true);
   const after=await snapshot(f);assert.deepEqual(after.runs,before.runs);assert.deepEqual(after.sessions,before.sessions);
  });
  await t.test('two independent candidates have one winner and one complete matching audit',async()=>{
   const f=await fixture(),other=['sqlite','postgres'].includes(kind)?await create():repository,inputs=[f.candidate(),f.candidate()];
   const results=await Promise.all([repository.commitContentReleaseActivation(inputs[0]),other.commitContentReleaseActivation(inputs[1])]);assert.equal(results.filter(Boolean).length,1);
   assert.deepEqual((await snapshot(f)).events,[inputs[results.indexOf(true)].activityEvent]);
  });
  await t.test('the activation use case retains open-run refusal, explicit force and all stored participant bytes',async()=>{
   const f=await fixture(),before=await snapshot(f);
   const service=createFirstSliceServices({repository:{...repository,saveContentRelease:()=>assert.fail('No separate status writes during activation.')},now:()=>activatedAt});
   const request={tenantKey:f.tenantId,workspaceKey:f.workspaceId,contentReleaseId:f.target.contentReleaseId,activatedByActorId:'owned'};
   await assert.rejects(service.contentIntake.activateContentRelease(request),error=>error.errorCode==='active_content_release_has_open_runs');
   assert.deepEqual((await snapshot(f)).releases,before.releases);
   const result=await service.contentIntake.activateContentRelease({...request,forceActivation:true});
   assert.equal(result.contentRelease.status,'active');assert.equal(result.activation.forced,true);assert.equal(result.activation.supersededOpenRunCount,1);
   const after=await snapshot(f);assert.deepEqual(after.runs,before.runs);assert.deepEqual(after.sessions,before.sessions);
   assert.equal(after.events.filter(event=>event.eventType==='content_release_activation_blocked').length,1);
   assert.deepEqual(after.events.find(event=>event.eventType==='content_release_activated').details,result.activation);
  });
  await t.test('legacy callers without an actor retain a null audit actor',async()=>{
   const f=await fixture(),service=createFirstSliceServices({repository,now:()=>activatedAt});
   const result=await service.contentIntake.activateContentRelease({tenantKey:f.tenantId,workspaceKey:f.workspaceId,
    contentReleaseId:f.target.contentReleaseId,forceActivation:true});
   assert.equal(result.contentRelease.status,'active');
   const audit=(await snapshot(f)).events;assert.equal(audit.length,1);assert.equal(audit[0].actorId,null);
  });
  await t.test('activation still resolves multiple preexisting active releases without rewriting their content',async()=>{
   const f=await fixture(),extra={...f.release,contentReleaseId:randomUUID(),releaseLabel:'Other previous active'};
   await repository.saveContentRelease(extra);const input=f.candidate();input.expectedRevision=await repository.getContentReleaseActivationRevision(f.tenantId,f.workspaceId);
   assert.equal(await repository.commitContentReleaseActivation(input),true);
   const after=await snapshot(f);assert.equal(after.releases.filter(row=>row.status==='active').length,1);
   assert.deepEqual(after.releases.find(row=>row.contentReleaseId===extra.contentReleaseId),{...extra,status:'superseded'});
   assert.deepEqual(after.releases.find(row=>row.contentReleaseId===f.release.contentReleaseId),{...f.release,status:'superseded'});
  });
  await t.test('a globally occupied audit ID in another workspace cannot be overwritten',async()=>{
   const f=await fixture(),other=await fixture(),input=f.candidate();
   await repository.saveWorkspaceActivityEvent({...input.activityEvent,tenantId:other.tenantId,workspaceId:other.workspaceId});
   const before=await snapshot(f),foreign=await snapshot(other);
   assert.equal(await repository.commitContentReleaseActivation(input),false);
   assert.deepEqual(await snapshot(f),before);assert.deepEqual(await snapshot(other),foreign);
  });
  if(kind==='postgres')await t.test('two actually queued PostgreSQL activations serialize on the same workspace row',async()=>{
   const f=await fixture(),names=['first','second'].map(name=>schema+'_'+name);
   const writers=await Promise.all(names.map(name=>{const connection=new URL(url);connection.searchParams.set('application_name',name);return create(connection);}));
   const holder=await control.connect(),inputs=[f.candidate(),f.candidate()];let first,second;
   const blocked=async name=>{const end=Date.now()+5000;do{
    const rows=(await rootPool.query('SELECT wait_event_type FROM pg_stat_activity WHERE application_name=$1',[name])).rows;
    if(rows.some(row=>row.wait_event_type==='Lock'))return;await new Promise(done=>setTimeout(done,10));
   }while(Date.now()<end);assert.fail('The actual activation did not wait on its workspace row.');};
   try{await holder.query('BEGIN');await holder.query('SELECT workspace_id FROM workspaces WHERE tenant_id=$1 AND workspace_id=$2 FOR UPDATE',[f.tenantId,f.workspaceId]);
    first=writers[0].commitContentReleaseActivation(inputs[0]).then(value=>({value}),error=>({error}));await blocked(names[0]);
    second=writers[1].commitContentReleaseActivation(inputs[1]).then(value=>({value}),error=>({error}));await blocked(names[1]);
   }finally{await holder.query('ROLLBACK');holder.release();}
   const results=await Promise.all([first,second]);for(const result of results)assert.ifError(result.error);
   assert.equal(results.filter(result=>result.value).length,1);
   const after=await snapshot(f);assert.equal(after.releases.filter(row=>row.status==='active').length,1);
   assert.deepEqual(after.events,[inputs[results.findIndex(result=>result.value)].activityEvent]);
  });
  await t.test('invalid scope, audit identity and late clone failure cannot leave partial activation',async()=>{
   const f=await fixture();
   for(const change of [input=>{input.workspaceId='missing';},input=>{input.activityEvent.subjectId='foreign';},input=>{input.activityEvent.details.previousActiveContentReleaseId='foreign';}]){
    const input=f.candidate();change(input);const before=await snapshot(f);assert.equal(await repository.commitContentReleaseActivation(input),false);assert.deepEqual(await snapshot(f),before);
   }
   const input=f.candidate(),before=await snapshot(f);input.activityEvent.details.uncloneable=()=>{};
   await assert.rejects(repository.commitContentReleaseActivation(input),/clone/i);assert.deepEqual(await snapshot(f),before);
   assert.equal(await repository.commitContentReleaseActivation(f.candidate()),true);
  });
  if(kind==='sqlite'||kind==='postgres')await t.test('late activation audit failure rolls back all release changes and a retry succeeds',async()=>{
   const f=await fixture(),input=f.candidate(),before=await snapshot(f);
   if(kind==='sqlite')control.exec("CREATE TRIGGER owned_activation_failure BEFORE INSERT ON workspace_activity_events WHEN NEW.event_type='content_release_activated' BEGIN SELECT RAISE(ABORT,'owned late activation'); END");
   else{await control.query("CREATE FUNCTION owned_activation_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned late activation'; END $$");await control.query('CREATE TRIGGER owned_activation_failure BEFORE INSERT ON workspace_activity_events FOR EACH ROW EXECUTE FUNCTION owned_activation_failure()');}
   try{await assert.rejects(repository.commitContentReleaseActivation(input),/owned late activation/);assert.deepEqual(await snapshot(f),before);}
   finally{if(kind==='sqlite')control.exec('DROP TRIGGER owned_activation_failure');else{await control.query('DROP TRIGGER owned_activation_failure ON workspace_activity_events');await control.query('DROP FUNCTION owned_activation_failure()');}}
   assert.equal(await repository.commitContentReleaseActivation(input),true);
  });
  if(kind==='file')await t.test('a final manifest failure preserves the old active release after reopening',async()=>{
   const f=await fixture(),input=f.candidate(),before=await snapshot(f),backup=file+'.backup';await rename(file,backup);await mkdir(file);
   try{await assert.rejects(repository.commitContentReleaseActivation(input));assert.deepEqual(await snapshot(f),before);}
   finally{await rm(file,{recursive:true,force:true});await rename(backup,file);}
   assert.deepEqual(await snapshot(f,await create()),before);assert.equal(await repository.commitContentReleaseActivation(input),true);
  });
 }finally{for(const storage of storages)await storage.shutdown();if(control){if(kind==='sqlite')control.close();else await control.end();}
  if(rootPool){await rootPool.query('DROP SCHEMA "'+schema+'" CASCADE');await rootPool.end();}await rm(folder,{recursive:true,force:true});}
});
