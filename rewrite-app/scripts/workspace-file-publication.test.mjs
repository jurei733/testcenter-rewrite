import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp, rm, rename, mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {Pool} from 'pg';
import {createWorkspaceFilePublicationRevision,createContentReleaseActivationRevision} from '@testcenter-rewrite-app/application';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceRepository} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';

const stamp='2026-10-22T12:00:00.000Z', clone=value=>structuredClone(value);
const kinds=process.env.FIRST_SLICE_STORE==='postgres'?['postgres']:['memory','file','sqlite'];
for(const kind of kinds)test(kind+': workspace publication commits its captured revision and all artifacts atomically',async t=>{
 const folder=await mkdtemp(join(tmpdir(),'owned-workspace-publication-'));
 const file=join(folder,kind==='sqlite'?'owned.sqlite':'owned.json');
 const schema='owned_publication_'+randomUUID().replaceAll('-',''), storages=[];
 const url=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;
 url?.searchParams.set('options','-c search_path='+schema);
 let rootPool,control,repository;
 const create=async(connection=url)=>{
  if(kind==='memory')return repository??createInMemoryFirstSliceRepository();
  if(kind==='file')return createFileFirstSliceRepository(file);
  const storage=kind==='sqlite'?createSqliteFirstSliceStorage(file):await createPostgresFirstSliceStorage(connection.toString());
  storages.push(storage);return storage.repository;
 };
 const snapshot=async(f,repo=repository)=>{const state=clone({
  sources:await repo.listSourcePackagesByWorkspace(f.tenantId,f.workspaceId),
  jobs:await repo.listImportJobsByWorkspace(f.tenantId,f.workspaceId),
  releases:await repo.listContentReleasesByWorkspace(f.tenantId,f.workspaceId),
  events:await repo.listWorkspaceActivityEventsByWorkspace(f.tenantId,f.workspaceId),
  sessions:await repo.listParticipantSessionsByWorkspace(f.tenantId,f.workspaceId),
  runs:await repo.listTestRunsByWorkspace(f.tenantId,f.workspaceId)
 });
 const keys={sources:'sourcePackageId',jobs:'importJobId',releases:'contentReleaseId',events:'activityEventId',sessions:'participantSessionId',runs:'testRunId'};
 for(const [name,rows] of Object.entries(state))rows.sort((a,b)=>a[keys[name]].localeCompare(b[keys[name]]));
 return state;};
 const fixture=async()=>{
  const key=randomUUID(),scope={tenantId:key,workspaceId:key};
  await repository.saveTenant({tenantId:key,tenantKey:key,displayName:'Owned',status:'active',createdAt:stamp});
  await repository.saveWorkspace({tenantKey:key,workspaceKey:key,workspace:{...scope,workspaceKey:key,displayName:'Owned',status:'active',createdAt:stamp}});
  const source={...scope,sourcePackageId:key,fileName:'Unit/owned.xml',mediaType:'application/xml',sourceDocument:'<Unit>Owned original bytes Ω</Unit>',
   contentStructure:null,status:'accepted',uploadedAt:stamp};
  await repository.saveSourcePackage(source);
  const release={...scope,contentReleaseId:key,importJobId:key,releaseLabel:'Previous',status:'active',createdAt:stamp,activatedAt:stamp,
   runtimeSnapshot:{bookletEntries:[]}};
  await repository.saveContentRelease(release);
  const parent={...scope,participantSessionId:key,contentReleaseId:key,loginKey:key,groupKey:key,status:'launched',createdAt:stamp};
  await repository.saveParticipantSession(parent);
  await repository.saveTestRun({...scope,testRunId:key,participantSessionId:key,contentReleaseId:key,bookletKey:'owned',status:'paused',
   currentUnitKey:'unit',unitResponses:{unit:'Exact stored answer Ω\n '},testletTimers:{},createdAt:stamp,updatedAt:stamp,completedAt:null});
  const revision=createWorkspaceFilePublicationRevision({sourcePackages:[source],activityEvents:[]});
  const candidate=()=>{
   const id=randomUUID(),derived={...source,sourcePackageId:id,fileName:'workspace-files.zip',mediaType:'application/zip',
    sourceDocument:'data:application/zip;base64,UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA=='};
   const job={...scope,importJobId:id,sourcePackageId:id,status:'completed',createdAt:stamp,finishedAt:stamp,diagnostics:[]};
   const next={...release,contentReleaseId:id,importJobId:id,runtimeSnapshot:{bookletEntries:[],workspaceFilePublication:{revision,sourcePackageId:id}}};
   const event=(eventType,subjectType,subjectId,details)=>({...scope,activityEventId:randomUUID(),eventType,subjectType,subjectId,
    actorId:null,occurredAt:stamp,summary:'Owned publication',details});
   return{sourcePackage:derived,importJob:job,contentRelease:next,expectedWorkspaceFileRevision:revision,expectedActiveContentReleaseId:key,
    expectedActiveContentReleaseRevision:createContentReleaseActivationRevision({contentReleases:[release],participantSessions:[],testRuns:[]}),
    activityEvents:[event('source_package_assembled','source_package',id,{assemblyMode:'workspace_files',workspaceFileRevision:revision,
     sourcePackages:[{sourcePackageId:key,fileName:source.fileName,sizeBytes:Buffer.byteLength(source.sourceDocument)}],importJobId:id,contentReleaseId:id}),
    event('import_job_completed','import_job',id,{sourcePackageId:id,contentReleaseId:id}),
    event('content_release_activated','content_release',id,{previousActiveContentReleaseId:key})]};
  };
  return{...scope,source,release,candidate,revision};
 };
 try{
  if(url){rootPool=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await rootPool.query('CREATE SCHEMA "'+schema+'"');control=new Pool({connectionString:url.toString()});}
  repository=await create();if(kind==='sqlite')control=new DatabaseSync(file);
  await t.test('publication retains exact original artifacts, sessions and answers; replay cannot supersede the winner',async()=>{
   const f=await fixture(),before=await snapshot(f),input=f.candidate();
   assert.equal(await repository.publishWorkspaceFiles(input),true);
   const after=await snapshot(f);
   assert.equal(after.sources.length,2);assert.equal(after.jobs.length,1);assert.equal(after.events.length,3);
   assert.deepEqual(after.sources.find(row=>row.sourcePackageId===f.source.sourcePackageId),f.source);
   assert.deepEqual(after.releases.find(row=>row.contentReleaseId===f.release.contentReleaseId),{...f.release,status:'superseded'});
   assert.equal(after.releases.filter(row=>row.status==='active').length,1);
   assert.deepEqual(after.sessions,before.sessions);assert.deepEqual(after.runs,before.runs);
   assert.equal(createWorkspaceFilePublicationRevision({sourcePackages:after.sources,activityEvents:after.events}),f.revision);
   assert.equal(await repository.publishWorkspaceFiles(f.candidate()),false);
   assert.deepEqual(await snapshot(f),after);
   if(kind!=='memory')assert.deepEqual(await snapshot(f,await create()),after);
  });
  await t.test('a changed live file after compilation cannot be blessed by a fresh active-release read',async()=>{
   const f=await fixture(),input=f.candidate();
   await repository.saveSourcePackage({...f.source,sourceDocument:'<Unit>New committed bytes Ω</Unit>'});
   const before=await snapshot(f);assert.equal(await repository.publishWorkspaceFiles(input),false);assert.deepEqual(await snapshot(f),before);
  });
  await t.test('a changed active release rejects the entire publication without orphan writes',async()=>{
   const f=await fixture(),input=f.candidate();
   await repository.saveContentRelease({...f.release,status:'superseded'});
   await repository.saveContentRelease({...f.release,contentReleaseId:randomUUID()});
   const before=await snapshot(f);assert.equal(await repository.publishWorkspaceFiles(input),false);assert.deepEqual(await snapshot(f),before);
  });
  await t.test('manual reactivation of the same active identity invalidates a previously captured first publication',async()=>{
   const f=await fixture(),input=f.candidate(),activatedAt='2026-10-22T12:01:00.000Z';
   const expectedRevision=await repository.getContentReleaseActivationRevision(f.tenantId,f.workspaceId);
   assert.equal(await repository.commitContentReleaseActivation({...f,contentReleaseId:f.release.contentReleaseId,activatedAt,expectedRevision,
    activityEvent:{...input.activityEvents[2],activityEventId:randomUUID(),subjectId:f.release.contentReleaseId,occurredAt:activatedAt}}),true);
   const before=await snapshot(f);assert.equal(await repository.publishWorkspaceFiles(input),false);assert.deepEqual(await snapshot(f),before);
  });
  await t.test('a late uncloneable audit cannot partially mutate any store',async()=>{
   const f=await fixture(),input=f.candidate(),before=await snapshot(f);
   input.activityEvents[2].details.unsafe=()=>{};
   await assert.rejects(repository.publishWorkspaceFiles(input));assert.deepEqual(await snapshot(f),before);
  });
  await t.test('foreign members, mismatched audit scope and occupied identities reject without writes',async()=>{
   for(const change of [input=>{input.activityEvents[0].details.sourcePackages[0].sourcePackageId='foreign';},
    input=>{input.activityEvents[2].workspaceId='foreign';},input=>{input.importJob.sourcePackageId='foreign';},
    input=>{input.contentRelease.runtimeSnapshot.workspaceFilePublication.revision='stale';},input=>{input.sourcePackage.sourcePackageId=input.expectedActiveContentReleaseId;}]){
    const f=await fixture(),input=f.candidate();change(input);
    const before=await snapshot(f);assert.equal(await repository.publishWorkspaceFiles(input),false);assert.deepEqual(await snapshot(f),before);
   }
  });
  await t.test('competing compilations have exactly one winner with all matching artifacts',async()=>{
   const f=await fixture(),other=['sqlite','postgres'].includes(kind)?await create():repository;
   const inputs=[f.candidate(),f.candidate()];
   const results=await Promise.all([repository.publishWorkspaceFiles(inputs[0]),other.publishWorkspaceFiles(inputs[1])]);
   assert.equal(results.filter(Boolean).length,1);
   const after=await snapshot(f),winner=inputs[results.indexOf(true)];
   assert.equal(after.sources.length,2);assert.deepEqual(after.jobs,[winner.importJob]);
   assert.deepEqual(after.releases.find(row=>row.status==='active'),winner.contentRelease);
   assert.deepEqual(after.events.map(row=>row.activityEventId).sort(),winner.activityEvents.map(row=>row.activityEventId).sort());
  });
  await t.test('a global ID owned by another workspace cannot be overwritten by publication',async()=>{
   for(const kind of ['source','job','release','event']){
    const f=await fixture(),foreign=await fixture(),input=f.candidate();
    const scope={tenantId:foreign.tenantId,workspaceId:foreign.workspaceId};
    if(kind==='source')await repository.saveSourcePackage({...input.sourcePackage,...scope});
    if(kind==='job')await repository.saveImportJob({...input.importJob,...scope,sourcePackageId:foreign.source.sourcePackageId});
    if(kind==='release')await repository.saveContentRelease({...input.contentRelease,...scope});
    if(kind==='event')await repository.saveWorkspaceActivityEvent({...input.activityEvents[0],...scope});
    const before=await snapshot(f),foreignBefore=await snapshot(foreign);
    assert.equal(await repository.publishWorkspaceFiles(input),false);
    assert.deepEqual(await snapshot(f),before);assert.deepEqual(await snapshot(foreign),foreignBefore);
   }
  });
  if(kind==='postgres')await t.test('two actual queued PostgreSQL publishers serialize at the workspace row',async()=>{
   const f=await fixture(),names=['first','second'].map(name=>schema+'_'+name);
   const writers=await Promise.all(names.map(async name=>{const connection=new URL(url);connection.searchParams.set('application_name',name);return create(connection);}));
   const holder=await control.connect(),inputs=[f.candidate(),f.candidate()];let first,second;
   const blocked=async name=>{
    const end=Date.now()+5000;
    do{const rows=(await rootPool.query('SELECT wait_event_type FROM pg_stat_activity WHERE application_name=$1',[name])).rows;
     if(rows.some(row=>row.wait_event_type==='Lock'))return;
     await new Promise(done=>setTimeout(done,10));
    }while(Date.now()<end);
    assert.fail('The actual publisher did not wait for its workspace row lock.');
   };
   try{
    await holder.query('BEGIN');await holder.query('SELECT workspace_id FROM workspaces WHERE tenant_id=$1 AND workspace_id=$2 FOR UPDATE',[f.tenantId,f.workspaceId]);
    first=writers[0].publishWorkspaceFiles(inputs[0]).then(value=>({value}),error=>({error}));await blocked(names[0]);
    second=writers[1].publishWorkspaceFiles(inputs[1]).then(value=>({value}),error=>({error}));await blocked(names[1]);
   }finally{await holder.query('ROLLBACK');holder.release();}
   const results=await Promise.all([first,second]);for(const result of results)assert.ifError(result.error);
   assert.equal(results.filter(result=>result.value).length,1);
   const after=await snapshot(f),winner=inputs[results.findIndex(result=>result.value)];
   assert.equal(after.sources.length,2);assert.deepEqual(after.jobs,[winner.importJob]);
   assert.equal(after.releases.filter(row=>row.status==='active').length,1);
   assert.deepEqual(after.events.map(row=>row.activityEventId).sort(),winner.activityEvents.map(row=>row.activityEventId).sort());
  });
  if(kind==='sqlite'||kind==='postgres')await t.test('a late activation-audit insert failure rolls back artifacts and superseding the previous release',async()=>{
   const f=await fixture(),input=f.candidate(),before=await snapshot(f);
   if(kind==='sqlite')control.exec("CREATE TRIGGER owned_publication_failure BEFORE INSERT ON workspace_activity_events WHEN NEW.event_type='content_release_activated' BEGIN SELECT RAISE(ABORT,'owned late publication'); END");
   else{await control.query("CREATE FUNCTION owned_publication_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type='content_release_activated' THEN RAISE EXCEPTION 'owned late publication'; END IF; RETURN NEW; END $$");
    await control.query('CREATE TRIGGER owned_publication_failure BEFORE INSERT ON workspace_activity_events FOR EACH ROW EXECUTE FUNCTION owned_publication_failure()');}
   try{await assert.rejects(repository.publishWorkspaceFiles(input),/owned late publication/);assert.deepEqual(await snapshot(f),before);}
   finally{if(kind==='sqlite')control.exec('DROP TRIGGER owned_publication_failure');else{await control.query('DROP TRIGGER owned_publication_failure ON workspace_activity_events');await control.query('DROP FUNCTION owned_publication_failure()');}}
   assert.equal(await repository.publishWorkspaceFiles(input),true);
  });
  if(kind==='file')await t.test('a failed final manifest write restores all state and allows the same input to retry',async()=>{
   const f=await fixture(),input=f.candidate(),before=await snapshot(f),backup=file+'.backup';
   await rename(file,backup);await mkdir(file);
   try{await assert.rejects(repository.publishWorkspaceFiles(input));assert.deepEqual(await snapshot(f),before);}
   finally{await rm(file,{recursive:true,force:true});await rename(backup,file);}
   assert.equal(await repository.publishWorkspaceFiles(input),true);
  });
 }finally{
  for(const storage of storages)await storage.shutdown();
  if(control){if(kind==='sqlite')control.close();else await control.end();}
  if(rootPool){await rootPool.query('DROP SCHEMA "'+schema+'" CASCADE');await rootPool.end();}
  await rm(folder,{recursive:true,force:true});
 }
});
