import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {mkdtemp,rm,readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {Pool} from 'pg';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {compileBookletRuntimePolicy} from '@testcenter-rewrite-app/contracts';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceStorage} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
import {prepareOriginalXmlSchemaValidator} from '../packages/application/dist/packages/application/src/original-xml-schema.js';
const originalXmlSchemaValidator=await prepareOriginalXmlSchemaValidator(resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE||'.data/original-xml-schemas'),process.env.FIRST_SLICE_XML_SCHEMA_DOWNLOAD!=='false');
const evidence=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-person-labels/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',evidence),'utf8')),bytes=await readFile(new URL('receipt.json',evidence));
assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.files['receipt.json']);assert.equal(manifest.runId,40047944217);
const source=JSON.parse(bytes);assert.equal(source.success,true);assert.equal(source.testMode,false);assert.equal(source.checks.length,53);
const casing=source.checks.find(row=>row.name.startsWith('native code casing records'));
const restarts=[false,true].map(coded=>source.checks.find(row=>row.name==='native always-new person persists '+(coded?'code-prefixed':'plain')+' eight-character suffix'));
const kinds=['memory','file','sqlite'];
if(process.env.FIRST_SLICE_STORE==='postgres'){assert.ok(process.env.FIRST_SLICE_POSTGRES_URL);kinds.push('postgres');}
for(const kind of kinds)test(`${kind}: native first code spelling and person suffix are durable server-owned identity`,async t=>{
 const directory=await mkdtemp(join(tmpdir(),'owned-native-person-')),file=join(directory,kind==='file'?'state.json':'state.sqlite');
 const schema='owned_person_'+randomUUID().replaceAll('-',''),url=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;url?.searchParams.set('options','-c search_path='+schema);
 let pool,storage,repository,services,control,created=false,first,second,run;
 const open=async()=>{storage=kind==='memory'?storage??{repository:createInMemoryFirstSliceRepository(),shutdown:async()=>{}}:kind==='file'?await createFileFirstSliceStorage(file):kind==='sqlite'?createSqliteFirstSliceStorage(file):await createPostgresFirstSliceStorage(url.toString());repository=storage.repository;services=createFirstSliceServices({repository,originalXmlSchemaValidator,requireLoginPassword:true});};
 try{
  if(url){pool=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await pool.query(`CREATE SCHEMA "${schema}"`);created=true;}
  await open();const tenant=await services.platform.createTenant({tenantKey:'owned-'+randomUUID(),displayName:'Owned native people'});
  const workspace=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'owned',displayName:'Owned native people'}),scope={tenantKey:tenant.tenantKey,workspaceKey:workspace.workspaceKey},release=randomUUID(),now=new Date().toISOString();
  await repository.saveContentRelease({tenantId:tenant.tenantId,workspaceId:workspace.workspaceId,contentReleaseId:release,importJobId:release,releaseLabel:'Owned fixed release',status:'active',createdAt:now,activatedAt:now,runtimeSnapshot:{bookletEntries:[{bookletKey:'owned',displayLabel:'Owned',policy:compileBookletRuntimePolicy({}),testletEntries:[],unitEntries:[]}]}});
  const entries=[['coded','run-hot-return',casing.assignedCode],['plain','run-hot-return',''],['restart-plain','run-hot-restart',''],['restart-coded','run-hot-restart',casing.assignedCode],['unicode','run-hot-return','Ä'],['zero','run-hot-return','0']];
  const document=group=>`<Testtakers xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/testcenter-testtaker-xml/18.0"><Metadata/><Group id="${group}" label="Owned people">${entries.map(([name,mode,code])=>`<Login name="${name}" pw="Owned-person-secret" mode="${mode}"><Booklet${code?' codes="'+code+'"':''}>owned</Booklet></Login>`).join('')}</Group></Testtakers>`;
  const upload=group=>services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:document(group)});
  const login=(loginKey,participantCode,extra={})=>services.participantRuntime.signIn({...scope,loginKey,password:'Owned-person-secret',...(participantCode===undefined?{}:{participantCode}),...extra});
  const get=id=>repository.getParticipantSessionById(id);
  await upload('ORACLE.PERSON');
  await t.test('case-insensitive code authorization retains the first requested spelling and reentry identity',async()=>{
   first=await login('coded',casing.firstRequestedCode,{originalNameSuffix:'forged'});
   assert.equal(first.participantCode,casing.testSessions[0].code);assert.equal(first.originalNameSuffix,casing.testSessions[0].nameSuffix);
   run=await services.participantRuntime.launch({participantSessionId:first.participantSessionId,bookletKey:'owned'});
   second=await login('coded',casing.secondRequestedCode);assert.equal(second.participantSessionId,first.participantSessionId);
   assert.equal(second.participantCode,first.participantCode);assert.equal(second.originalNameSuffix,first.originalNameSuffix);
   assert.equal((await services.participantRuntime.getRuntimeState({participantSessionId:first.participantSessionId})).booklets.length,1);
   assert.equal((await repository.listTestRunsByParticipantSessionId(first.participantSessionId))[0].testRunId,run.testRunId);
  });
  await t.test('native code authorization does not trim a wrong code or conflate Unicode letters',async()=>{
   for(const [name,code]of [['coded',' abc '],['coded','\tabc'],['unicode','ä']])await assert.rejects(login(name,code),e=>e.errorCode==='participant_code_invalid');
   const exact=await login('unicode','Ä');assert.equal(exact.participantCode,'Ä');assert.equal(exact.originalNameSuffix,'Ä');
  });
  await t.test('non-coded native people retain an observed empty suffix; numeric zero follows Source suffix truthiness',async()=>{
   const plain=await login('plain');assert.equal(plain.originalNameSuffix,'');assert.equal((await login('plain')).participantSessionId,plain.participantSessionId);
   const zero=await login('zero','0');assert.equal(zero.participantCode,'0');assert.equal(zero.originalNameSuffix,'');
  });
  await t.test('always-new people persist two independent Source-shaped plain/code-prefixed suffixes',async()=>{
   for(const [index,row]of restarts.entries()){
    const persons=await Promise.all([login(index?'restart-coded':'restart-plain',row.requestedCode),login(index?'restart-coded':'restart-plain',row.requestedCode)]);
    assert.notEqual(persons[0].participantSessionId,persons[1].participantSessionId);assert.notEqual(persons[0].originalNameSuffix,persons[1].originalNameSuffix);
    for(const person of persons){assert.equal(person.participantCode??'',row.testSessions[0].code);assert.match(person.originalNameSuffix,index?/^abc\/[a-z0-9_-]{8}$/:/^[a-z0-9_-]{8}$/);assert.equal((await get(person.participantSessionId)).originalNameSuffix,person.originalNameSuffix);}
   }
  });
  await t.test('group movement and stale parent saves retain first code/suffix, including omitted pointer metadata',async()=>{
   await upload('ORACLE.MOVED');const moved=await login('coded','ABC');assert.equal(moved.participantSessionId,first.participantSessionId);assert.equal(moved.groupKey,'ORACLE.MOVED');
   const {originalLoginKey,originalNameSuffix,...stale}=first;await repository.saveParticipantSession(stale);
   const stored=await get(first.participantSessionId);assert.equal(stored.originalLoginKey,originalLoginKey);assert.equal(stored.originalNameSuffix,originalNameSuffix);assert.equal(stored.participantCode,'abc');assert.equal(stored.groupKey,'ORACLE.MOVED');
   for(const patch of [{participantCode:'ABC'},{participantCode:null},{originalNameSuffix:'forged'},{originalNameSuffix:null}])await assert.rejects(repository.saveParticipantSession({...stored,...patch}),/first stored code|stored suffix/);
   assert.deepEqual(await get(first.participantSessionId),stored);
  });
  await t.test('invalid fresh suffixes cannot create rows and unknown native history cannot be backfilled',async()=>{
   const current=await get(first.participantSessionId),before=await repository.listParticipantSessionsByWorkspace(tenant.tenantId,workspace.workspaceId);
   for(const patch of [{originalNameSuffix:'forged'},{originalNameSuffix:'abc/UPPER123',executionMode:'run-hot-restart'},{executionMode:'unknown'}])await assert.rejects(repository.saveParticipantSession({...current,participantSessionId:randomUUID(),...patch}),/Invalid native person/);
   assert.deepEqual(await repository.listParticipantSessionsByWorkspace(tenant.tenantId,workspace.workspaceId),before);
   const binding=(await repository.listOriginalLoginBindingsByWorkspace(tenant.tenantId,workspace.workspaceId)).find(row=>row.loginKey===first.loginKey);
   await repository.bindOriginalLoginGroup({...binding,loginKey:'historical-native',authenticatedAt:new Date().toISOString()});
   const legacy={...current,participantSessionId:randomUUID(),loginKey:'historical-native',originalLoginKey:'historical-native',originalNameSuffix:undefined,participantCode:'Old'};
   await repository.saveParticipantSession(legacy);assert.equal((await get(legacy.participantSessionId)).originalNameSuffix,undefined);
   await assert.rejects(repository.saveParticipantSession({...legacy,originalNameSuffix:'Old'}),/must stay unknown/);
   assert.equal((await get(legacy.participantSessionId)).originalNameSuffix,undefined);
  });
  await t.test('canonical code normalization stays unchanged and cannot claim a native suffix or inferred identity',async()=>{
   await services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:JSON.stringify([{loginKey:'canonical',password:'Owned-person-secret',groupKey:'Canonical',booklets:[{id:'owned',codes:'AbC'}],originalNameSuffix:'forged'}])});
   const canonical=await login('canonical','abc');assert.equal(canonical.participantCode,'AbC');assert.equal(canonical.originalNameSuffix,undefined);
   await assert.rejects(repository.saveParticipantSession({...canonical,originalNameSuffix:''}),/requires a native login identity/);
   await assert.rejects(repository.saveParticipantSession({...canonical,loginKey:first.loginKey,originalLoginKey:first.originalLoginKey,originalNameSuffix:'AbC'}),/existing legacy person/);
   assert.deepEqual(await get(canonical.participantSessionId),canonical);
  });
  if(kind!=='memory')await t.test('native raw code and both suffix forms survive durable reopening',async()=>{
   const before=await repository.listParticipantSessionsByWorkspace(tenant.tenantId,workspace.workspaceId);await storage.shutdown();await open();
   assert.deepEqual((await repository.listParticipantSessionsByWorkspace(tenant.tenantId,workspace.workspaceId)).sort((a,b)=>a.participantSessionId.localeCompare(b.participantSessionId)),before.sort((a,b)=>a.participantSessionId.localeCompare(b.participantSessionId)));
  });
  if(kind==='file')await t.test('failed durable suffix creation leaves parent rows and cache untouched',async()=>{
   await login('restart-coded','abc');
   const before=await repository.listParticipantSessionsByWorkspace(tenant.tenantId,workspace.workspaceId),backup=file+'.backup',bind=repository.bindOriginalLoginGroup;let blocked=false;
   repository.bindOriginalLoginGroup=async input=>{const binding=await bind(input);await rename(file,backup);blocked=true;await mkdir(file);return binding;};
   try{await assert.rejects(login('restart-coded','abc'));assert.equal(blocked,true);assert.deepEqual(await repository.listParticipantSessionsByWorkspace(tenant.tenantId,workspace.workspaceId),before);}
   finally{repository.bindOriginalLoginGroup=bind;if(blocked){await rm(file,{recursive:true,force:true});await rename(backup,file);}}
  });
  if(kind==='sqlite'||kind==='postgres')await t.test('late SQL suffix insert failure leaves no partial parent and a later signup succeeds',async()=>{
   // The credential step may legitimately move the Login group before person creation.
   await login('restart-coded','abc');
   const before=await repository.listParticipantSessionsByWorkspace(tenant.tenantId,workspace.workspaceId);control=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()});
   const execute=sql=>kind==='sqlite'?control.exec(sql):control.query(sql);
   try{
    await execute(kind==='sqlite'?"CREATE TRIGGER owned_suffix_fail BEFORE INSERT ON participant_sessions WHEN NEW.login_key='restart-coded' BEGIN SELECT RAISE(ABORT,'owned suffix failure'); END;":"CREATE FUNCTION owned_suffix_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.login_key='restart-coded' THEN RAISE EXCEPTION 'owned suffix failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER owned_suffix_fail BEFORE INSERT ON participant_sessions FOR EACH ROW EXECUTE FUNCTION owned_suffix_fail();");
    await assert.rejects(login('restart-coded','abc'),/owned suffix failure/);assert.deepEqual(await repository.listParticipantSessionsByWorkspace(tenant.tenantId,workspace.workspaceId),before);
    await execute(kind==='sqlite'?'DROP TRIGGER owned_suffix_fail':'DROP TRIGGER owned_suffix_fail ON participant_sessions; DROP FUNCTION owned_suffix_fail()');
    assert.match((await login('restart-coded','abc')).originalNameSuffix,/^abc\/[a-z0-9_-]{8}$/);
   }finally{if(kind==='sqlite')control.close();else await control.end();control=null;}
  });
  if(kind!=='memory')await t.test('upgrading old manifests/SQL keeps unknown suffix history and existing Tests instead of reconstructing it',async()=>{
   const before=await get(first.participantSessionId);await storage.shutdown();
   if(kind==='file'){
    const data=JSON.parse(await readFile(file,'utf8'));for(const parent of Object.values(data.participantSessions))delete parent.originalNameSuffix;await writeFile(file,JSON.stringify(data));
   }else{
    control=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()});
    const sql='ALTER TABLE participant_sessions DROP COLUMN original_name_suffix; DELETE FROM schema_migrations WHERE version='+(kind==='sqlite'?69:63);
    if(kind==='sqlite'){control.exec(sql);control.close();}else{await control.query(sql);await control.end();}control=null;
   }
   await open();const legacy=await get(first.participantSessionId),{originalNameSuffix,...known}=before;assert.deepEqual(legacy,known);
   const reentry=await login('coded','ABC');assert.equal(reentry.participantSessionId,first.participantSessionId);assert.equal(reentry.originalNameSuffix,undefined);
   await assert.rejects(repository.saveParticipantSession({...legacy,originalNameSuffix:'abc'}),/must stay unknown/);
   assert.equal((await repository.listTestRunsByParticipantSessionId(first.participantSessionId))[0].testRunId,run.testRunId);
  });
 }finally{await storage?.shutdown();if(created)await pool.query(`DROP SCHEMA "${schema}" CASCADE`);await pool?.end();await rm(directory,{recursive:true,force:true});}
});
