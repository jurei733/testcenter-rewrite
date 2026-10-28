import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rename,mkdir,rm,readFile} from 'node:fs/promises';
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
const timestamp='2026-10-21T06:00:00.000Z',clone=v=>structuredClone(v);
const kinds=['memory','file','sqlite',...(process.env.FIRST_SLICE_STORE==='postgres'?['postgres']:[])];
for(const kind of kinds)test(kind+': settings merge and its audit share the latest durable write boundary',async t=>{
 const folder=await mkdtemp(join(tmpdir(),'settings-atomic-')),file=join(folder,kind==='sqlite'?'owned.sqlite':'owned.json');
 const schema='owned_settings_'+randomUUID().replaceAll('-',''),storages=[];let rootPool,control,repository;
 const pg=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;pg?.searchParams.set('options','-c search_path='+schema);
 const create=async(url=pg)=>{
  if(kind==='memory')return repository??createInMemoryFirstSliceRepository();if(kind==='file')return createFileFirstSliceRepository(file);
  const storage=kind==='sqlite'?createSqliteFirstSliceStorage(file):await createPostgresFirstSliceStorage(url.toString());storages.push(storage);return storage.repository;
 };
 const services=repo=>createFirstSliceServices({repository:repo,now:()=>timestamp});
 const snapshot=async(repo=repository)=>({settings:await repo.getApplicationSettings(),audit:await repo.listAdminAuditEvents()});
 try{
  if(pg){rootPool=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await rootPool.query('CREATE SCHEMA "'+schema+'"');control=new Pool({connectionString:pg.toString()});}
  repository=await create();if(kind==='sqlite')control=new DatabaseSync(file);
  const service=services(repository),username='owned-settings',password='Owned-settings-password-9!';
  await service.adminAuth.bootstrapAdminUser({username,password});const auth=await service.adminAuth.signIn({username,password});
  const sessionToken=auth.adminSession.token;
  const patch=(fields,repo=repository)=>services(repo).applicationSettings.patchOriginalApplicationSettings({sessionToken,...fields});
  await service.applicationSettings.updateApplicationSettings({sessionToken,appTitle:'Original title',customTexts:{gm_headline:'Old',unknown:'  authored Ω  '},globalWarningText:'Warning',globalWarningExpiresAt:'2099-12-23T14:00:00.000Z'});
  await t.test('a held editor merges its keys into the committed newer editor without any stale whole-map read',async()=>{
   const arrived=Promise.withResolvers(),release=Promise.withResolvers();
   const held={...repository,getApplicationSettings:()=>{throw Error('Original patch must not read a stale snapshot outside its mutation.');},
    async mutateApplicationSettings(transform){arrived.resolve();await release.promise;return repository.mutateApplicationSettings(transform);}};
   const first=patch({customTexts:{gm_headline:'  Changed\n title  '}},held);await arrived.promise;
   await patch({appTitle:'Other administrator',globalWarningText:'New warning',customTexts:{newer:'New key'}});
   const preceding=await snapshot();release.resolve();const result=await first;
   assert.equal(result.appTitle,'Other administrator');assert.equal(result.globalWarningText,'New warning');assert.equal(result.globalWarningExpiresAt,'2099-12-23T14:00:00.000Z');
   assert.deepEqual(result.customTexts,{gm_headline:'  Changed\n title  ',unknown:'  authored Ω  ',newer:'New key'});
   const after=await snapshot();assert.deepEqual(after.settings,result);assert.equal(after.audit.length,preceding.audit.length+1);
   const audit=after.audit.find(row=>!preceding.audit.some(old=>old.adminAuditEventId===row.adminAuditEventId));
   assert.equal(audit.details.previousAppTitle,'Other administrator');assert.equal(audit.details.previousCustomTextCount,3);assert.deepEqual(audit.details.changedCustomTextKeys,['gm_headline']);
   if(kind!=='memory')assert.deepEqual(await snapshot(await create()),after);
  });
  await t.test('legacy replacement and omitted-warning clearing stay distinct from Original patch semantics',async()=>{
   await service.applicationSettings.updateApplicationSettings({sessionToken,appTitle:'Legacy title',customTexts:{only:'Replacement'}});
   const legacy=await repository.getApplicationSettings();assert.deepEqual(legacy.customTexts,{only:'Replacement'});assert.equal(legacy.globalWarningText,null);assert.equal(legacy.globalWarningExpiresAt,null);
   await patch({globalWarningText:'Keep',globalWarningExpiresAt:'2099-12-23T14:00:00.000Z'});await patch({customTexts:{added:' Added '}});
   const merged=await repository.getApplicationSettings();assert.deepEqual(merged.customTexts,{only:'Replacement',added:' Added '});assert.equal(merged.appTitle,'Legacy title');assert.equal(merged.globalWarningText,'Keep');
   await patch({globalWarningText:null,globalWarningExpiresAt:null});assert.equal((await repository.getApplicationSettings()).globalWarningText,null);
  });
  await t.test('combined-map limits and missing assets reject the entire settings and audit edit',async()=>{
   const customTexts=Object.fromEntries(Array.from({length:250},(_,i)=>['owned_'+i,'Value']));
   await service.applicationSettings.updateApplicationSettings({sessionToken,appTitle:'Limit',customTexts});const before=await snapshot();
   await assert.rejects(patch({appTitle:'Must not commit',customTexts:{overflow:'Extra'}}),error=>error.errorCode==='application_custom_texts_too_large');assert.deepEqual(await snapshot(),before);
   await assert.rejects(patch({appTitle:'Missing asset',assetAssignments:{logo:'absent.png'}}),error=>error.errorCode==='application_asset_assignment_missing');assert.deepEqual(await snapshot(),before);
   await assert.rejects(patch({customTexts:{'bad key':'Invalid'}}),error=>error.errorCode==='application_custom_texts_invalid');assert.deepEqual(await snapshot(),before);
  });
  if(control)await t.test('a late audit insert failure rolls back settings together with the audit',async()=>{
   const before=await snapshot(),execute=sql=>kind==='sqlite'?control.exec(sql):control.query(sql);
   await execute(kind==='sqlite'?"CREATE TRIGGER owned_settings_failure BEFORE INSERT ON admin_audit_events BEGIN SELECT RAISE(ABORT,'owned settings audit failure'); END":
    "CREATE FUNCTION owned_settings_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned settings audit failure'; END $$; CREATE TRIGGER owned_settings_failure BEFORE INSERT ON admin_audit_events FOR EACH ROW EXECUTE FUNCTION owned_settings_failure()");
   try{await assert.rejects(patch({appTitle:'Must roll back'}),/owned settings audit failure/);assert.deepEqual(await snapshot(),before);}
   finally{await execute(kind==='sqlite'?'DROP TRIGGER owned_settings_failure':'DROP TRIGGER owned_settings_failure ON admin_audit_events; DROP FUNCTION owned_settings_failure()');}
  });
  if(kind==='file')await t.test('a failed manifest replacement keeps cached and durable settings and audit exact',async()=>{
   const before=await snapshot();await rename(file,file+'.backup');await mkdir(file);
   try{await assert.rejects(patch({appTitle:'Must roll back'}));assert.deepEqual(await snapshot(),before);}
   finally{await rm(file,{recursive:true,force:true});await rename(file+'.backup',file);}
   assert.deepEqual(await snapshot(await create()),before);
  });
  if(pg)await t.test('two actual independent writers queue on the same lock and merge against the newly committed map',async()=>{
   await service.applicationSettings.updateApplicationSettings({sessionToken,appTitle:'Concurrent',customTexts:{baseline:'Keep'},globalWarningText:'Keep warning'});
   const names=['first','second'].map(role=>'owned_settings_'+role+'_'+randomUUID()),repos=[];
   for(const name of names){const url=new URL(pg);url.searchParams.set('application_name',name);repos.push(await create(url));}
   const holder=await control.connect();let first,second;
   const blocked=async name=>{const deadline=Date.now()+5000;do{
    const result=await control.query("SELECT wait_event FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'",[name]);
    if(result.rows.some(row=>row.wait_event==='advisory'))return;await new Promise(done=>setTimeout(done,10));
   }while(Date.now()<deadline);assert.fail('Actual writer did not wait on the shared settings/asset lock.');};
   try{await holder.query('BEGIN');await holder.query('SELECT pg_advisory_xact_lock(1413693779, hashtext(current_schema()))');
    first=patch({appTitle:'First editor',customTexts:{first:'One'}},repos[0]).then(value=>({value}),error=>({error}));await blocked(names[0]);
    second=patch({customTexts:{second:'Two'}},repos[1]).then(value=>({value}),error=>({error}));await blocked(names[1]);
   }finally{await holder.query('ROLLBACK');holder.release();}
   assert.ifError((await first).error);assert.ifError((await second).error);const result=await repository.getApplicationSettings();
   assert.equal(result.appTitle,'First editor');assert.equal(result.globalWarningText,'Keep warning');assert.deepEqual(result.customTexts,{baseline:'Keep',first:'One',second:'Two'});
  });
 }finally{
  for(const storage of storages)await storage.shutdown();if(control){if(kind==='sqlite')control.close();else await control.end();}
  if(rootPool){await rootPool.query('DROP SCHEMA "'+schema+'" CASCADE');await rootPool.end();}await rm(folder,{recursive:true,force:true});
 }
});

if(process.env.FIRST_SLICE_POSTGRES_URL)test('actual pinned Source meta SQL preserves keys omitted by separate editors',async()=>{
 const reference=JSON.parse(await readFile(new URL('../test-fixtures/original-testcenter/current-settings-patch-reference.json',import.meta.url),'utf8'));
 assert.equal(reference.originalCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');
 assert.ok(reference.files[0].excerpt.includes('foreach ($requestBody as $key => $value)'));
 assert.ok(reference.files[2].excerpt.includes('this.backendService.setCustomTexts(this.changedData)'));
 const pool=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL}),client=await pool.connect(),schema='owned_source_settings_'+randomUUID().replaceAll('-','');
 const query=async(sql,bindings)=>{const keys=[...new Set(sql.match(/:[a-z]+/g))];return client.query(sql.replace(/:[a-z]+/g,key=>'$'+(keys.indexOf(key)+1)),keys.map(key=>bindings[key]));};
 const patch=async(category,fields)=>{for(const [key,value] of Object.entries(fields)){
  const bindings={':key':key,':category':category,':value':value};
  const current=(await query(reference.sql.read,bindings)).rows[0]?.value;
  await query(current?reference.sql.update:reference.sql.insert,bindings);
 }};
 try{await client.query('CREATE SCHEMA "'+schema+'"');await client.query('SET search_path="'+schema+'"');await client.query(reference.table);
  await patch('appConfig',{appTitle:'Source title',globalWarningText:'Warning'});await patch('customTexts',{gm_headline:'Old',unknown:'  authored Ω  '});
  await patch('customTexts',{newer:'New key'});await patch('appConfig',{appTitle:'Other administrator'});await patch('customTexts',{gm_headline:'  Changed\n title  '});
  const rows=(await client.query('SELECT "metaKey",value FROM meta')).rows;
  assert.deepEqual(Object.fromEntries(rows.map(row=>[row.metaKey,row.value])),{appTitle:'Other administrator',globalWarningText:'Warning',gm_headline:'  Changed\n title  ',unknown:'  authored Ω  ',newer:'New key'});
 }finally{await client.query('SET search_path=public');await client.query('DROP SCHEMA "'+schema+'" CASCADE');client.release();await pool.end();}
});
