import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID,createHash} from 'node:crypto';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {Pool} from 'pg';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceStorage} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
import {prepareOriginalXmlSchemaValidator} from '../packages/application/dist/packages/application/src/original-xml-schema.js';
import {systemCheckXml} from './native-system-check-fixture.mjs';
const fixture=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-syscheck-directory-http/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',fixture)));
for(const[name,digest]of Object.entries(manifest.files))assert.equal(createHash('sha256').update(await readFile(new URL(name,fixture))).digest('hex'),digest);
const source=JSON.parse(await readFile(new URL('observations.json',fixture)));
assert.equal(source.verified,true);assert.equal(source.actualSourceBackend,true);assert.equal(source.sqlSeedsOrDaoStubs,false);assert.equal(source.xmlSchemaValidation,true);assert.equal(source.allowTestMode,false);assert.equal(Object.keys(source.sourceHashes).length,137);
const observed=label=>{const row=source.snapshots.find(row=>row.label===label);assert.ok(row,label);return row;};
const validator=await prepareOriginalXmlSchemaValidator(resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE||'.data/original-xml-schemas'),false);
const kinds=['memory','file','sqlite',...(process.env.FIRST_SLICE_STORE==='postgres'?['postgres']:[])];
for(const kind of kinds)test(kind+': persisted native Systemcheck mode follows actual Source file lifecycle',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'owned-syscheck-directory-')),file=join(dir,kind==='file'?'state.json':'state.sqlite'),namespace='owned_syscheck_directory_'+randomUUID().replaceAll('-','');
 const pg=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;pg?.searchParams.set('options','-c search_path='+namespace);
 let storage,repository,services,control,pool,scope,ids,number,firstNumber;
 const open=async()=>{storage=kind==='memory'?storage??{repository:createInMemoryFirstSliceRepository(),shutdown:async()=>{}}:kind==='file'?await createFileFirstSliceStorage(file):kind==='sqlite'?createSqliteFirstSliceStorage(file):await createPostgresFirstSliceStorage(pg.toString());repository=storage.repository;services=createFirstSliceServices({repository,originalXmlSchemaValidator:validator,xmlSchemaProfile:'original-19'});};
 const close=async()=>{await storage?.shutdown();if(kind!=='memory')storage=undefined;};
 const create=async key=>{const tenant=await services.platform.createTenant({tenantKey:'owned-'+randomUUID(),displayName:'Owned'}),workspace=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:key,displayName:'Owned'});scope={tenantKey:tenant.tenantKey,workspaceKey:key};ids={tenantId:tenant.tenantId,workspaceId:workspace.workspaceId};number=await repository.getOrCreateOriginalWorkspaceNumber(ids);if(key==='first')firstNumber=number;};
 const upload=(fileName,sourceDocument)=>services.contentIntake.uploadWorkspaceFile({...scope,fileName,mediaType:'application/xml',sourceDocument});
 const roster=(id,mode)=>systemCheckXml('Testtakers','<Metadata/><Group id="OWNED.'+id+'" label="Owned"><Login name="owned-'+id+'" pw="owned-password" mode="'+mode+'"/></Group>');
 const storedType=async()=>kind==='sqlite'?control.prepare('SELECT original_content_type FROM workspaces WHERE workspace_id=?').get(ids.workspaceId)?.original_content_type:kind==='postgres'?(await control.query('SELECT original_content_type FROM workspaces WHERE workspace_id=$1',[ids.workspaceId])).rows[0]?.original_content_type:kind==='file'?JSON.parse(await readFile(file,'utf8')).originalWorkspaceContentTypes[ids.workspaceId]:undefined;
 const check=async label=>{const row=observed(label);assert.equal(await services.originalSystemCheck.mode(),row.mode,label);const list=await services.originalSystemCheck.list();assert.equal(list===null?204:200,row.status,label);if(list!==null)assert.deepEqual(JSON.parse(list),row.list.map(entry=>({...entry,workspaceId:Number(firstNumber)})),label);const expected=row.contentTypes.find(item=>item.id===row.workspace)?.content_type;if(expected&&kind!=='memory')assert.equal(await storedType(),expected,label);};
 const remove=async sourcePackage=>services.contentIntake.deleteSourcePackage({...scope,sourcePackageId:sourcePackage.sourcePackageId,confirmation:sourcePackage.fileName});
 try{
  if(pg){pool=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await pool.query('CREATE SCHEMA "'+namespace+'"');control=new Pool({connectionString:pg.toString()});}
  await open();if(kind==='sqlite')control=new DatabaseSync(file);await create('first');
  let checkFile,ordinary,special;
  await t.test('new workspace and physical public check preserve mixed mode',async()=>{await check('new');checkFile=(await upload('check.xml',systemCheckXml('SysCheck','<Metadata><Id>R103.CHECK</Id><Label>Public check</Label><Description>Public description</Description></Metadata><Config skipnetwork="true" savekey="owned-key"/>'))).sourcePackage;await check('check-only');});
  await t.test('private imported login rows alone do not enable installation mode',async()=>{await services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:roster('private','sys-check-login')});assert.equal(await services.originalSystemCheck.mode(),false);});
  await t.test('valid physical ordinary then special Login changes test to sysCheck',async()=>{ordinary=(await upload('ordinary.xml',roster('ordinary','run-hot-return'))).sourcePackage;await check('ordinary-only');special=(await upload('special.xml',roster('special','sys-check-login'))).sourcePackage;await check('mixed-logins');});
  await t.test('valid replacement updates mode and installs a usable native Systemcheck login',async()=>{const ordinaryReplacement=await upload('special.xml',roster('special','run-hot-return'));special=ordinaryReplacement.replacementSourcePackage??ordinaryReplacement.sourcePackage;await check('valid-replacement-ordinary');const restored=await upload('special.xml',roster('special','sys-check-login'));special=restored.replacementSourcePackage??restored.sourcePackage;await check('valid-replacement-restored');const actor=await services.originalSession.login({name:'owned-special',password:'owned-password'});assert.equal(actor.claims.sysCheck.length,1);assert.equal(String(actor.claims.sysCheck[0].workspaceId),number);});
  if(kind==='sqlite'||kind==='postgres')await t.test('content-type write failure rolls back the physical file and lineage together',async()=>{
   const before=await repository.readOriginalSystemCheckDirectory();
   if(kind==='sqlite')control.exec("CREATE TRIGGER owned_block_content_type BEFORE UPDATE OF original_content_type ON workspaces BEGIN SELECT RAISE(ABORT,'owned-mode-write-fault'); END;");
   else await control.query("CREATE FUNCTION owned_block_content_type() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned-mode-write-fault'; END $$; CREATE TRIGGER owned_block_content_type BEFORE UPDATE OF original_content_type ON workspaces FOR EACH ROW EXECUTE FUNCTION owned_block_content_type();");
   try{await assert.rejects(upload('blocked.xml',roster('blocked','sys-check-login')),/owned-mode-write-fault/);assert.deepEqual(await repository.readOriginalSystemCheckDirectory(),before);assert.equal(await services.originalSystemCheck.mode(),true);}
   finally{if(kind==='sqlite')control.exec('DROP TRIGGER owned_block_content_type;');else await control.query('DROP TRIGGER owned_block_content_type ON workspaces; DROP FUNCTION owned_block_content_type();');}
  });
  await t.test('invalid replacement retains the previous physical Login and stored mode',async()=>{await assert.rejects(upload('special.xml','<Testtakers><malformed>'));await check('invalid-replacement');});
  await t.test('restart and migration backfill use physical files rather than current login rows',async()=>{await close();if(kind==='sqlite'){control.exec('DROP INDEX original_workspace_content_type; ALTER TABLE workspaces DROP COLUMN original_content_type; DELETE FROM schema_migrations WHERE version=83;');}else if(kind==='postgres'){await control.query('ALTER TABLE workspaces DROP COLUMN original_content_type; DELETE FROM schema_migrations WHERE version=77;');}else if(kind==='file'){const {writeFile}=await import('node:fs/promises');const document=JSON.parse(await readFile(file,'utf8'));delete document.originalWorkspaceContentTypes;await writeFile(file,JSON.stringify(document));}await open();if(kind==='file'){assert.equal(await services.originalSystemCheck.mode(),true);await close();await open();assert.equal(await services.originalSystemCheck.mode(),true);await repository.saveWorkspace({...scope,workspace:await repository.getWorkspaceByScope(scope.tenantKey,scope.workspaceKey)});}await check('mixed-logins');});
  await t.test('rename and stale workspace saves cannot overwrite stored mode',async()=>{const workspace=await repository.getWorkspaceByScope(scope.tenantKey,scope.workspaceKey);await repository.saveWorkspace({...scope,workspace:{...workspace,displayName:'Renamed'}});await check('mixed-logins');});
  await t.test('deleting physical rosters returns to test then mixed despite stale imported rows',async()=>{await remove(special);await check('special-deleted-ordinary-remains');await assert.rejects(services.originalSession.login({name:'owned-special',password:'owned-password'}),error=>error.statusCode===401);await remove(ordinary);await check('all-rosters-deleted');});
  await t.test('global mode spans workspaces and is independent from public check availability',async()=>{const first={scope,ids,number};await create('second');const second={scope,ids,number};await upload('special.xml',roster('second','sys-check-login'));await check('second-workspace-special');({scope,ids,number}=first);await remove(checkFile);await check('check-deleted-mode-stays');({scope,ids,number}=second);const tenant=await repository.getTenantByKey(scope.tenantKey);await repository.saveTenant({...tenant,status:'suspended'});assert.equal(await services.originalSystemCheck.mode(),false);assert.equal(await services.originalSystemCheck.list(),null);await repository.saveTenant({...tenant,status:'active'});assert.equal(await services.originalSystemCheck.mode(),true);});
 }finally{await close();if(kind==='sqlite')control?.close();await control?.end?.();if(pool){await pool.query('DROP SCHEMA "'+namespace+'" CASCADE');await pool.end();}await rm(dir,{recursive:true,force:true});}
});
