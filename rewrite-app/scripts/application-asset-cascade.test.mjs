import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,readFile,rename,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {Pool} from 'pg';
import {defaultApplicationSettings} from '@testcenter-rewrite-app/domain';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceRepository} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
const timestamp='2026-10-20T10:00:00.000Z',clone=value=>structuredClone(value);
const kinds=['memory','file','sqlite',...(process.env.FIRST_SLICE_STORE==='postgres'?['postgres']:[])];
for(const kind of kinds)test(kind+': asset deletion owns catalog, global/scoped bindings and audit',async t=>{
 const folder=await mkdtemp(join(tmpdir(),'asset-cascade-')),file=join(folder,kind==='sqlite'?'owned.sqlite':'owned.json');
 const schema='owned_asset_'+randomUUID().replaceAll('-',''),storages=[];let rootPool,control;
 const pg=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;
 pg?.searchParams.set('options','-c search_path='+schema);
 const create=async()=>{
  if(kind==='memory')return createInMemoryFirstSliceRepository();if(kind==='file')return createFileFirstSliceRepository(file);
  const storage=kind==='sqlite'?createSqliteFirstSliceStorage(file):await createPostgresFirstSliceStorage(pg.toString());storages.push(storage);return storage.repository;
 };
 try{
  if(pg){rootPool=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await rootPool.query('CREATE SCHEMA "'+schema+'"');control=new Pool({connectionString:pg.toString()});}
  const repository=await create();if(kind==='sqlite')control=new DatabaseSync(file);
  const tenant={tenantId:'tenant-owned',tenantKey:'owned',displayName:'Owned',status:'active',createdAt:timestamp};
  const workspace={workspaceId:'workspace-owned',tenantId:tenant.tenantId,workspaceKey:'owned',displayName:'Owned',status:'active',createdAt:timestamp};
  await repository.saveTenant(tenant);await repository.saveWorkspace({tenantKey:tenant.tenantKey,workspaceKey:workspace.workspaceKey,workspace});
  const victim={applicationAssetId:'asset-owned',originalName:'owned.png',mediaType:'image/png',dataBase64:'b3duZWQ=',byteLength:5,createdAt:timestamp,updatedAt:timestamp};
  const keep={...victim,applicationAssetId:'asset-keep',originalName:'keep.png'};
  const roster={participantRosterEntryId:'roster-owned',tenantId:tenant.tenantId,workspaceId:workspace.workspaceId,loginKey:'owned-login',groupKey:'owned-group',bookletKey:null,displayName:'Padded Ω',passwordRequired:true,customTexts:{login_subtitle:'  exact  '},assetAssignments:{logo:'keep.png',codeInputCompanion:'owned.png'},importedAt:timestamp};
  const candidates=[{loginKey:'owned-monitor',loginMode:'monitor-group',groupKey:'owned-group',passwordRequired:true,profileIds:[],monitorProfiles:[],monitorBookletVisibility:'visible',customTexts:{gm_headline:'  exact monitor  '},assetAssignments:{logo:'keep.png',starterCompanion:'owned.png'},unresolvedProfileIds:[]}];
  const source={sourcePackageId:'source-owned',tenantId:tenant.tenantId,workspaceId:workspace.workspaceId,fileName:'source.xml',mediaType:'application/xml',contentStructure:null,sourceDocument:'<Testtakers><Asset>owned.png</Asset></Testtakers>\n',status:'accepted',uploadedAt:timestamp};
  const seed=async()=>{
   for(const asset of await repository.listApplicationAssets())if(asset.originalName===victim.originalName&&asset.applicationAssetId!==victim.applicationAssetId)await repository.deleteApplicationAsset(asset.applicationAssetId);
   await repository.saveApplicationAsset(clone(victim));await repository.saveApplicationAsset(clone(keep));
   await repository.saveApplicationSettings({...clone(defaultApplicationSettings),appTitle:'Owned title',customTexts:{login_subtitle:'  exact global  '},assetAssignments:{logo:'owned.png',loginIllustration:'keep.png'},globalWarningText:'keep warning'});
   await repository.saveParticipantRosterEntry(clone(roster),'owned-password-hash');
   await repository.replaceOperationalLoginMigrationCandidatesByWorkspace(tenant.tenantId,workspace.workspaceId,clone(candidates));
   await repository.saveSourcePackage(clone(source));
   await repository.replaceOperationalLoginMigrationCandidatesByWorkspace("orphan-tenant","orphan-workspace",clone(candidates));
  };
  const input=(id=randomUUID(),cascadeAssignments=true)=>({applicationAssetId:victim.applicationAssetId,cascadeAssignments,
   auditEvent:{adminAuditEventId:id,eventType:'application_asset_deleted',actorAdminUserId:null,subjectAdminUserId:null,occurredAt:timestamp,summary:'Owned deletion',details:{applicationAssetId:victim.applicationAssetId}}});
  const snapshot=async()=>({assets:(await repository.listApplicationAssets()).sort((a,b)=>a.originalName.localeCompare(b.originalName)),settings:await repository.getApplicationSettings(),roster:await repository.listParticipantRosterEntriesByWorkspace(tenant.tenantId,workspace.workspaceId),password:await repository.getParticipantRosterPasswordHash(tenant.tenantId,workspace.workspaceId,roster.loginKey),candidates:await repository.listOperationalLoginMigrationCandidatesByWorkspace(tenant.tenantId,workspace.workspaceId),orphans:await repository.listOperationalLoginMigrationCandidatesByWorkspace('orphan-tenant','orphan-workspace'),source:await repository.getSourcePackageById(source.sourcePackageId),audits:await repository.listAdminAuditEvents()});
  await seed();
  await t.test('the legacy guard rejects all references without any data or audit write',async()=>{
   const before=await snapshot();await assert.rejects(repository.mutateApplicationAssetDeletion(input(undefined,false)),error=>error.errorCode==='application_asset_in_use'&&error.details.rosterReferenceCount===3);
   assert.deepEqual(await snapshot(),before);
  });
  await t.test('cascade removes only the deleted image and leaves credentials, authored source and other bindings exact',async()=>{
   const before=await snapshot(),operation=input();assert.deepEqual(await repository.mutateApplicationAssetDeletion(operation),victim);
   const after=await snapshot();assert.equal(after.assets.some(asset=>asset.applicationAssetId===victim.applicationAssetId),false);
   assert.deepEqual(after.settings,{...before.settings,assetAssignments:{loginIllustration:'keep.png'},updatedAt:timestamp});
   assert.deepEqual(after.roster,[{...before.roster[0],assetAssignments:{logo:'keep.png'}}]);
   assert.deepEqual(after.candidates,[{...before.candidates[0],assetAssignments:{logo:'keep.png'}}]);
   assert.deepEqual(after.orphans,[{...before.orphans[0],assetAssignments:{logo:'keep.png'}}]);
   assert.equal(after.password,before.password);assert.deepEqual(after.source,before.source);assert.equal(after.audits.length,before.audits.length+1);
   assert.equal(after.audits.at(-1).details.clearedRosterReferenceCount,3);
   assert.deepEqual(after.audits.at(-1).details.clearedGlobalSlots,['logo']);
   assert.equal(await repository.mutateApplicationAssetDeletion(input()),null);assert.deepEqual(await snapshot(),after);
   if(kind!=='memory'){
    const reopened=await create();assert.deepEqual(await reopened.getApplicationSettings(),after.settings);
    assert.equal(await reopened.getParticipantRosterPasswordHash(tenant.tenantId,workspace.workspaceId,roster.loginKey),'owned-password-hash');
   }
  });
  await t.test('stale assignment writers cannot restore missing references after deletion',async()=>{
   const before=await snapshot();
   await assert.rejects(repository.saveParticipantRosterEntry(clone(roster),'must-not-replace-hash'),error=>error.errorCode==='application_asset_assignment_missing');
   await assert.rejects(repository.saveApplicationSettings({...before.settings,assetAssignments:{logo:'owned.png'}}),error=>error.errorCode==='application_asset_assignment_missing');
   await assert.rejects(repository.replaceOperationalLoginMigrationCandidatesByWorkspace(tenant.tenantId,workspace.workspaceId,candidates),error=>error.errorCode==='application_asset_assignment_missing');
   assert.deepEqual(await snapshot(),before);
  });
  await t.test('reupload and atomic filename replacement do not resurrect the deleted identity or old assignments',async()=>{
   const fresh={...victim,applicationAssetId:'new-image-identity',createdAt:'2026-10-20T12:00:00.000Z'};
   const uploaded=await repository.saveApplicationAsset(fresh,true);assert.equal(uploaded.applicationAsset.applicationAssetId,'new-image-identity');
   const replacement=await repository.saveApplicationAsset({...fresh,applicationAssetId:'unused-candidate',dataBase64:'bmV3',byteLength:3},true);
   assert.equal(replacement.applicationAsset.applicationAssetId,fresh.applicationAssetId);assert.equal(replacement.applicationAsset.createdAt,fresh.createdAt);assert.equal(uploaded.replaced,false);assert.equal(replacement.replaced,true);
   const sameCandidate=await repository.saveApplicationAsset({...fresh,applicationAssetId:replacement.applicationAsset.applicationAssetId},true);assert.equal(sameCandidate.replaced,true);
   const after=await snapshot();assert.equal(after.settings.assetAssignments.logo,undefined);assert.equal(after.roster[0].assetAssignments.codeInputCompanion,undefined);assert.equal(after.candidates[0].assetAssignments.starterCompanion,undefined);
  });
  if(control)await t.test('a late audit failure rolls back the image, every assignment and the deletion audit together',async()=>{
   await seed();const before=await snapshot();
   const install=kind==='sqlite'?"CREATE TRIGGER owned_asset_failure BEFORE INSERT ON admin_audit_events BEGIN SELECT RAISE(ABORT,'owned asset audit failure'); END":
    "CREATE FUNCTION owned_asset_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned asset audit failure'; END $$; CREATE TRIGGER owned_asset_failure BEFORE INSERT ON admin_audit_events FOR EACH ROW EXECUTE FUNCTION owned_asset_failure()";
   const remove=kind==='sqlite'?'DROP TRIGGER owned_asset_failure':'DROP TRIGGER owned_asset_failure ON admin_audit_events; DROP FUNCTION owned_asset_failure()';
   const execute=query=>kind==='sqlite'?control.exec(query):control.query(query);await execute(install);
   try{await assert.rejects(repository.mutateApplicationAssetDeletion(input()),/owned asset audit failure/);assert.deepEqual(await snapshot(),before);}finally{await execute(remove);}
  });
  if(kind==='postgres')await t.test('a queued cross-connection stale writer cannot restore a deleted binding or replace its password',async()=>{
   await seed();
   const before=await snapshot(),names=['delete','writer'].map(role=>'owned_asset_'+role+'_'+randomUUID());
   const repositories=[];
   for(const name of names){
    const url=new URL(pg);url.searchParams.set('application_name',name);
    const storage=await createPostgresFirstSliceStorage(url.toString());storages.push(storage);repositories.push(storage.repository);
   }
   const holder=await control.connect();let deletion,write;
   const blocked=async name=>{
    const deadline=Date.now()+5000;
    do{
     const state=await control.query("SELECT wait_event FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'",[name]);
     if(state.rows.some(row=>row.wait_event==='advisory'))return;
     await new Promise(done=>setTimeout(done,10));
    }while(Date.now()<deadline);
    assert.fail('The actual '+name+' connection did not block on the shared catalog/assignment lock.');
   };
   try{
    await holder.query('BEGIN');await holder.query('SELECT pg_advisory_xact_lock(1413693779, hashtext(current_schema()))');
    deletion=repositories[0].mutateApplicationAssetDeletion(input()).then(value=>({value}),error=>({error}));
    await blocked(names[0]);
    write=repositories[1].saveParticipantRosterEntry(clone(roster),'must-not-replace-concurrent-hash').then(value=>({value}),error=>({error}));
    await blocked(names[1]);
   }finally{await holder.query('ROLLBACK');holder.release();}
   const deleted=await deletion;assert.ifError(deleted.error);assert.deepEqual(deleted.value,victim);
   const rejected=await write;assert.equal(rejected.error?.errorCode,'application_asset_assignment_missing');
   const after=await snapshot();assert.deepEqual(after.roster,[{...before.roster[0],assetAssignments:{logo:'keep.png'}}]);
   assert.equal(after.password,before.password);assert.equal(after.audits.length,before.audits.length+1);
  });
  if(kind==='file')await t.test('a failed manifest commit retains the previous cached and durable state',async()=>{
   await seed();const before=await snapshot();await rename(file,file+'.backup');await mkdir(file);
   try{await assert.rejects(repository.mutateApplicationAssetDeletion(input()));assert.deepEqual(await snapshot(),before);}
   finally{await rm(file,{recursive:true,force:true});await rename(file+'.backup',file);}
   const reopened=await create();assert.deepEqual(await reopened.getApplicationSettings(),before.settings);
  });
 }finally{
  for(const storage of storages)await storage.shutdown();if(control){if(kind==='sqlite')control.close();else await control.end();}
  if(rootPool){await rootPool.query('DROP SCHEMA "'+schema+'" CASCADE');await rootPool.end();}await rm(folder,{recursive:true,force:true});
 }
});
if(process.env.FIRST_SLICE_POSTGRES_URL)test('actual pinned Source SQL removes assignment rows and a reupload receives a new identity',async()=>{
 const reference=JSON.parse(await readFile(new URL('../test-fixtures/original-testcenter/current-asset-deletion-reference.json',import.meta.url),'utf8'));
 const pool=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL}),client=await pool.connect(),schema='owned_source_assets_'+randomUUID().replaceAll('-','');
 try{await client.query('CREATE SCHEMA "'+schema+'"');await client.query('SET search_path="'+schema+'"');
  await client.query(reference.scopeType);for(const table of reference.tables)await client.query(table);
  const old=(await client.query("INSERT INTO assets(original_name,stored_name) VALUES('owned.png','old-owned.png') RETURNING id")).rows[0].id;
  await client.query("INSERT INTO asset_assignment(workspace_id,slot_name,asset_id,scope,scope_id) VALUES(0,'logo',$1,'global','global'),(7,'loginIllustration',$1,'group','owned')",[old]);
  await client.query(reference.deleteSql.replace(':id','$1'),[old]);assert.equal(Number((await client.query('SELECT COUNT(*) AS n FROM asset_assignment')).rows[0].n),0);
  const fresh=(await client.query("INSERT INTO assets(original_name,stored_name) VALUES('owned.png','new-owned.png') RETURNING id")).rows[0].id;
  assert.notEqual(fresh,old);assert.equal(Number((await client.query('SELECT COUNT(*) AS n FROM asset_assignment')).rows[0].n),0);
 }finally{await client.query('SET search_path=public');await client.query('DROP SCHEMA "'+schema+'" CASCADE');client.release();await pool.end();}
});
