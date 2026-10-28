import assert from 'node:assert/strict';
import {randomUUID,scryptSync} from 'node:crypto';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import test from 'node:test';
import {Pool} from 'pg';
import {DatabaseSync} from 'node:sqlite';
import {createFirstSliceServices,prepareOriginalOperationalLogins} from '@testcenter-rewrite-app/application';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceStorage} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
import {prepareOriginalXmlSchemaValidator} from '../packages/application/dist/packages/application/src/original-xml-schema.js';
const validator=await prepareOriginalXmlSchemaValidator(resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE||'.data/original-xml-schemas'),process.env.FIRST_SLICE_XML_SCHEMA_DOWNLOAD!=='false');
const kinds=['memory','file','sqlite'];
if(process.env.FIRST_SLICE_STORE==='postgres'){assert.ok(process.env.FIRST_SLICE_POSTGRES_URL);kinds.push('postgres');}
for(const kind of kinds)test(`${kind}: private native operational identities survive restart, remain isolated and expire on replacement/deletion`,async t=>{
 const dir=await mkdtemp(join(tmpdir(),'owned-operational-')),file=join(dir,kind==='file'?'state.json':'state.sqlite');
 const schema='owned_operational_'+randomUUID().replaceAll('-','');
 const url=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;url?.searchParams.set('options','-c search_path='+schema);
 let storage,repository,services,pool,created=false;
 const open=async()=>{storage=kind==='memory'?storage??{repository:createInMemoryFirstSliceRepository(),shutdown:async()=>{}}:kind==='file'?await createFileFirstSliceStorage(file):kind==='sqlite'?createSqliteFirstSliceStorage(file):await createPostgresFirstSliceStorage(url.toString());repository=storage.repository;services=createFirstSliceServices({repository,originalXmlSchemaValidator:validator});};
 const close=async()=>{const owned=storage;if(kind!=='memory')storage=undefined;await owned?.shutdown();};
 try{
  if(url){pool=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await pool.query(`CREATE SCHEMA "${schema}"`);created=true;}
  await open();const tenant=await services.platform.createTenant({tenantKey:'owned-'+randomUUID(),displayName:'Owned monitor credentials'});
  const workspace=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'owned',displayName:'Owned monitor credentials'});
  const scope={tenantKey:tenant.tenantKey,workspaceKey:workspace.workspaceKey},ids=[tenant.tenantId,workspace.workspaceId];
  const document=(password='Owned Ω &amp; secret',name='monitor')=>`<Testtakers xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/testcenter-testtaker-xml/18.0"><Metadata/><Group id="ORACLE.COMMAND" label="Owned monitor"><Login name="${name}" pw="${password}" mode="monitor-group"/><Login name="study" pw="Owned-study" mode="monitor-study"/><Login name="check" mode="sys-check-login"/></Group></Testtakers>`;
  const upload=xml=>services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:xml});
  const privateRows=()=>repository.listOriginalOperationalLoginsByWorkspace(...ids);
  const publicRows=()=>repository.listOperationalLoginMigrationCandidatesByWorkspace(...ids);
  const verify=(hash,password)=>{const [scheme,salt,digest]=hash.split('$');assert.equal(scheme,'scrypt');assert.equal(scryptSync(password,salt,64).toString('hex'),digest);};
  let first;
  await t.test('validated XML stores salted hashes without participant entries, people or administrator promotion',async()=>{
   const admins=await repository.listAdminUsers();await upload(document());assert.deepEqual(await repository.listAdminUsers(),admins);first=await privateRows();assert.equal(first.length,3);
   verify(first.find(row=>row.loginKey==='monitor').passwordHash,'Owned Ω & secret');
   assert.equal(first.find(row=>row.loginKey==='check').passwordHash,null);
   assert.deepEqual(await repository.listParticipantRosterEntriesByWorkspace(...ids),[]);
   assert.deepEqual(await repository.listParticipantSessionsByWorkspace(...ids),[]);
   for(const candidate of await publicRows()){assert.equal('passwordHash'in candidate,false);assert.equal('password'in candidate,false);assert.equal('nativeLogins'in candidate,false);}
   const other=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'other',displayName:'Other'});
   assert.deepEqual(await repository.listOriginalOperationalLoginsByWorkspace(tenant.tenantId,other.workspaceId),[]);
  });
  await t.test('restart and returned-object mutation cannot change durable private credentials',async()=>{
   await close();await open();assert.deepEqual(await privateRows(),first);
   const changed=await privateRows();changed[0].passwordHash=null;changed.pop();assert.deepEqual(await privateRows(),first);
  });
  if(kind==='sqlite'||kind==='postgres')await t.test('real previous-schema upgrade rolls back on failure and never invents native credentials',async()=>{
   const candidates=await publicRows();await close();
   const control=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()});
   const exec=async sql=>kind==='sqlite'?control.exec(sql):control.query(sql);
   const version=kind==='sqlite'?76:70;
   const columns=async()=>kind==='sqlite'?control.prepare('PRAGMA table_info(operational_login_migration_candidates)').all().map(row=>row.name):(await control.query("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='operational_login_migration_candidates'")).rows.map(row=>row.column_name);
   try{
    await exec(`DROP TABLE IF EXISTS original_person_numbers; DROP TABLE IF EXISTS original_person_number_counter; DROP INDEX IF EXISTS original_person_number_parent_scope; DROP TABLE IF EXISTS original_native_commands; DROP TABLE IF EXISTS original_native_command_counter; ALTER TABLE participant_sessions DROP COLUMN original_operational_mode; ALTER TABLE operational_login_migration_candidates DROP COLUMN native_logins_json; DELETE FROM schema_migrations WHERE version>=${version}`);
    await exec(kind==='sqlite'?`CREATE TRIGGER owned_ops_upgrade_failure BEFORE INSERT ON schema_migrations WHEN NEW.version=${version} BEGIN SELECT RAISE(ABORT,'owned operational upgrade failure'); END`:`CREATE FUNCTION owned_ops_upgrade_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned operational upgrade failure'; END $$; CREATE TRIGGER owned_ops_upgrade_failure BEFORE INSERT ON schema_migrations FOR EACH ROW WHEN (NEW.version=${version}) EXECUTE FUNCTION owned_ops_upgrade_failure()`);
    await assert.rejects(open(),/owned operational upgrade failure/);assert.equal((await columns()).includes('native_logins_json'),false);
    await exec(kind==='sqlite'?'DROP TRIGGER owned_ops_upgrade_failure':'DROP TRIGGER owned_ops_upgrade_failure ON schema_migrations; DROP FUNCTION owned_ops_upgrade_failure()');
   }finally{if(kind==='sqlite')control.close();else await control.end();}
   await open();assert.deepEqual(await publicRows(),candidates);assert.deepEqual(await privateRows(),[]);
  });
  await t.test('reimport replaces credentials and preserves raw password whitespace and XML entity decoding',async()=>{
   await upload(document('  replacement &amp; Ω  '));const next=await privateRows();
   verify(next.find(row=>row.loginKey==='monitor').passwordHash,'  replacement & Ω  ');
   assert.notEqual(next.find(row=>row.loginKey==='monitor').passwordHash,first.find(row=>row.loginKey==='monitor').passwordHash);
  });
  await t.test('invalid credential records fail before changing either private or public half',async()=>{
   const before=await privateRows(),candidates=await publicRows();
   for(const rows of [[{...before[0],passwordHash:'plaintext'}],[before[0],before[0]],[{...before[0],loginMode:'sys-check-login'}],[{...before[0],loginKey:'foreign'}]]){
    await assert.rejects(repository.replaceOperationalLoginMigrationCandidatesByWorkspace(...ids,candidates,rows),TypeError);
    assert.deepEqual(await privateRows(),before);assert.deepEqual(await publicRows(),candidates);
   }
   assert.throws(()=>prepareOriginalOperationalLogins(candidates,[{...before[0],passwordHash:null}]),TypeError);
   await assert.rejects(repository.replaceOperationalLoginMigrationCandidatesByWorkspace(...ids,candidates.map(row=>({...row,assetAssignments:{logo:'owned-missing.png'}})),before.map(row=>row.passwordHash?{...row,passwordHash:'scrypt$'+'a'.repeat(32)+'$'+'b'.repeat(128)}:row)));
   assert.deepEqual(await privateRows(),before);assert.deepEqual(await publicRows(),candidates);
   const poisoned=prepareOriginalOperationalLogins(candidates,[{...before[0],password:'must not persist'}]);assert.equal('password'in poisoned[0],false);
  });
  await t.test('invalid XML and duplicate identities cannot replace valid credentials',async()=>{
   const before=await privateRows();await assert.rejects(upload(document().replace('mode="monitor-group"','mode="invented"')));
   await assert.rejects(upload(document('secret','study')));assert.deepEqual(await privateRows(),before);
  });
  await t.test('JSON candidates cannot establish a native identity and clear previous private credentials',async()=>{
   const json={metadata:{},groups:[{id:'ORACLE.COMMAND',label:'Owned monitor',logins:[{name:'monitor',pw:'forged',mode:'monitor-group',originalLoginIdentity:true}]}]};
   const before=await privateRows();await assert.rejects(upload(json));assert.deepEqual(await privateRows(),before);
   delete json.groups[0].logins[0].originalLoginIdentity;await upload(json);
   assert.deepEqual(await privateRows(),[]);assert.equal((await publicRows()).length,1);
  });
  if(kind==='file')await t.test('legacy manifests without the new private collection remain readable',async()=>{
   await close();const state=JSON.parse(await readFile(file,'utf8'));delete state.originalOperationalLogins;await writeFile(file,JSON.stringify(state));await open();assert.deepEqual(await privateRows(),[]);
  });
  await t.test('role replacement and workspace deletion remove all private native credentials',async()=>{
   await upload(document());await repository.replaceOperationalLoginMigrationCandidatesByWorkspace(...ids,[]);assert.deepEqual(await privateRows(),[]);
   await upload(document());const candidates=await publicRows(),rows=await privateRows();
   await repository.deleteWorkspaceAggregate({...scope,tenantId:ids[0],workspaceId:ids[1],auditEvent:{adminAuditEventId:randomUUID(),eventType:'workspace_deleted',actorAdminUserId:null,subjectAdminUserId:null,occurredAt:new Date().toISOString(),summary:'Owned deletion',details:{}}});
   assert.deepEqual(await privateRows(),[]);await assert.rejects(repository.replaceOperationalLoginMigrationCandidatesByWorkspace(...ids,candidates,rows));assert.deepEqual(await privateRows(),[]);
  });
 }finally{await close();if(created)await pool.query(`DROP SCHEMA "${schema}" CASCADE`);await pool?.end();await rm(dir,{recursive:true,force:true});}
});
