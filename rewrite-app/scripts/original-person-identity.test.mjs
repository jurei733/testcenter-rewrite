import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {mkdtemp,rm,readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {Pool,types as pgTypes} from 'pg';
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
const lifecycleEvidence=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-person-lifecycle/',import.meta.url);
const lifecycleManifest=JSON.parse(await readFile(new URL('manifest.json',lifecycleEvidence),'utf8'));
assert.equal(lifecycleManifest.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');assert.equal(lifecycleManifest.runId,40052775596);
assert.equal(lifecycleManifest.probeCommit,'9192fe560283a3b94c7ebc442d62c12fc7a602f6');
assert.equal(lifecycleManifest.artifact.sha256,'4ec626a3ed7a405ea2f0672c540e2363de53db58c7de36ae121380a376b2b117');
assert.equal(Object.keys(lifecycleManifest.files).length,13);
for(const [name,sha] of Object.entries(lifecycleManifest.files)){
 assert.match(name,/^[a-z0-9][a-z0-9.-]*$/);assert.equal(createHash('sha256').update(await readFile(new URL(name,lifecycleEvidence))).digest('hex'),sha,name);
}
const lifecycle=JSON.parse(await readFile(new URL('receipt.json',lifecycleEvidence),'utf8'));
assert.equal(lifecycle.success,true);assert.equal(lifecycle.testMode,false);assert.equal(lifecycle.checks.length,62);
const zeroAloneSource=lifecycle.checks.find(row=>row.name==='standalone zero codes attribute is PHP-falsy and creates an uncoded native person');
const zeroMixedSource=lifecycle.checks.find(row=>row.name==='native zero-code to no-code transition records empty suffix reuse and subsequent Test access');
assert.equal(zeroAloneSource.codeRequired,false);assert.equal(zeroMixedSource.testOpenStatus,201);
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
  const entries=[['coded','run-hot-return',casing.assignedCode],['plain','run-hot-return',''],['restart-plain','run-hot-restart',''],['restart-coded','run-hot-restart',casing.assignedCode],['unicode','run-hot-return','Ä'],['zero','run-hot-return','0 AbC'],['zero-alone','run-hot-return','0']];
  const suffixRows=lifecycle.checks.filter(row=>row.name.startsWith('native person suffix collation retains first spelling for '));
  assert.equal(suffixRows.length,2);
  entries.push(...suffixRows.map((row,index)=>['suffix-'+index,'run-hot-return',row.firstRequestedCode+' '+row.secondRequestedCode]),['suffix-concurrent','run-hot-return','AbC'],['suffix-mode','run-hot-return','AbC'],['suffix-cycle','run-hot-return','AbC'],['suffix-live-fresh','run-hot-return','AbC']);
  const document=(group,selected=entries)=>`<Testtakers xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/testcenter-testtaker-xml/18.0"><Metadata/><Group id="${group}" label="Owned people">${selected.map(([name,mode,code])=>`<Login name="${name}" pw="Owned-person-secret" mode="${mode}"><Booklet${code?' codes="'+code+'"':''}>owned</Booklet></Login>`).join('')}</Group></Testtakers>`;
  const upload=(group,names)=>services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:document(group,names?entries.filter(entry=>names.includes(entry[0])):entries)});
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
  await t.test('a standalone native zero codes attribute is uncoded; zero in a mixed list keeps its raw code',async()=>{
   const zeroAlone=await login('zero-alone');assert.equal(zeroAlone.participantCode??'',zeroAloneSource.testSessions[0].code);assert.equal(zeroAlone.originalNameSuffix,zeroAloneSource.testSessions[0].nameSuffix);
   assert.equal((await login('zero-alone','0')).participantSessionId,zeroAlone.participantSessionId);
   const plain=await login('plain');assert.equal(plain.originalNameSuffix,'');assert.equal((await login('plain')).participantSessionId,plain.participantSessionId);
   const zero=await login('zero','0');assert.equal(zero.participantCode,zeroMixedSource.testSessions[0].code);assert.equal(zero.originalNameSuffix,zeroMixedSource.testSessions[0].nameSuffix);
  });
  await t.test('always-new people persist two independent Source-shaped plain/code-prefixed suffixes',async()=>{
   for(const [index,row]of restarts.entries()){
    const persons=await Promise.all([login(index?'restart-coded':'restart-plain',row.requestedCode),login(index?'restart-coded':'restart-plain',row.requestedCode)]);
    assert.notEqual(persons[0].participantSessionId,persons[1].participantSessionId);assert.notEqual(persons[0].originalNameSuffix,persons[1].originalNameSuffix);
    for(const person of persons){assert.equal(person.participantCode??'',row.testSessions[0].code);assert.match(person.originalNameSuffix,index?/^abc\/[a-z0-9_-]{8}$/:/^[a-z0-9_-]{8}$/);assert.equal((await get(person.participantSessionId)).originalNameSuffix,person.originalNameSuffix);}
   }
  });
  for(const [index,row]of suffixRows.entries())await t.test('Source62 '+row.name+' reuses the stored person and unchanged Test',async()=>{
   const name='suffix-'+index,firstPerson=await login(name,row.firstRequestedCode);
   const created=await services.participantRuntime.launch({participantSessionId:firstPerson.participantSessionId,bookletKey:'owned'});
   await repository.saveTestRun({...created,unitResponses:{'owned-suffix':'Exact Ω\n'},unitResponseFieldTimestamps:{'owned-suffix':{opaque:123}}});
   const before=await repository.getTestRunById(created.testRunId),secondPerson=await login(name,row.secondRequestedCode);
   assert.equal(row.testId,row.originalTestId);assert.equal(secondPerson.participantSessionId,firstPerson.participantSessionId);
   assert.equal(secondPerson.participantCode,row.testSessions[0].code);assert.equal(secondPerson.originalNameSuffix,row.testSessions[0].nameSuffix);
   assert.deepEqual(await repository.getTestRunById(created.testRunId),before);
   assert.equal((await repository.listParticipantSessionsByWorkspace(tenant.tenantId,workspace.workspaceId)).filter(p=>p.loginKey===name).length,1);
   const snapshot=await repository.listParticipantSessionsByWorkspace(tenant.tenantId,workspace.workspaceId);
   await assert.rejects(repository.saveParticipantSession({...firstPerson,participantSessionId:randomUUID(),participantCode:row.secondRequestedCode,originalNameSuffix:row.secondRequestedCode}),/suffix already belongs/);
   assert.deepEqual(await repository.listParticipantSessionsByWorkspace(tenant.tenantId,workspace.workspaceId),snapshot);
  });
  await t.test('Source62 zero to no-code transition retains first raw code, empty suffix and the same Test',async()=>{
   const zero=await login('zero','0'),created=await services.participantRuntime.launch({participantSessionId:zero.participantSessionId,bookletKey:'owned'});
   const before=await repository.getTestRunById(created.testRunId),entry=entries.find(entry=>entry[0]==='zero');entry[2]='';await upload('ORACLE.PERSON',['zero']);
   try{
    const noCode=await login('zero');assert.equal(noCode.participantSessionId,zero.participantSessionId);
    assert.equal(noCode.participantCode,zeroMixedSource.testSessions[0].code);assert.equal(noCode.originalNameSuffix,zeroMixedSource.testSessions[0].nameSuffix);
    assert.deepEqual(await repository.getTestRunById(created.testRunId),before,'Person resolution must not edit existing Test state or clocks');
    assert.equal((await services.participantRuntime.launch({participantSessionId:noCode.participantSessionId,bookletKey:'owned'})).testRunId,created.testRunId);
   }finally{entry[2]='0 AbC';await upload('ORACLE.PERSON',['zero']);}
  });
  await t.test('concurrent native reentry converges across SQL clients; File permits only its registered writer',async()=>{
   let peerStorage;
   if(kind==='file')await assert.rejects(createFileFirstSliceStorage(file),error=>error.code==='FILE_STORE_BUSY');
   if(kind==='sqlite')peerStorage=createSqliteFirstSliceStorage(file);
   if(kind==='postgres')peerStorage=await createPostgresFirstSliceStorage(url.toString());
   try{
    const peer=peerStorage?createFirstSliceServices({repository:peerStorage.repository,originalXmlSchemaValidator,requireLoginPassword:true}):services;
    const persons=await Promise.all(Array.from({length:12},(_,index)=>(index%2?peer:services).participantRuntime.signIn({...scope,loginKey:'suffix-concurrent',password:'Owned-person-secret',participantCode:index%2?'ABC':'abc'})));
    assert.equal(new Set(persons.map(p=>p.participantSessionId)).size,1);
    for(const person of persons){assert.equal(person.participantCode,persons[0].participantCode);assert.equal(person.originalNameSuffix,persons[0].originalNameSuffix);}
    assert.equal((await repository.listParticipantSessionsByWorkspace(tenant.tenantId,workspace.workspaceId)).filter(p=>p.loginKey==='suffix-concurrent').length,1);
    const snapshot=await repository.listParticipantSessionsByWorkspace(tenant.tenantId,workspace.workspaceId);
    await assert.rejects(repository.resolveOriginalParticipantSession({...persons[0],participantSessionId:randomUUID(),executionMode:'run-review'},person=>{person.participantCode='owned-invalid';person.originalNameSuffix='owned-invalid';throw Error('owned before-publication validation');}),/owned before-publication validation/);
    assert.deepEqual(await repository.listParticipantSessionsByWorkspace(tenant.tenantId,workspace.workspaceId),snapshot);
   }finally{await peerStorage?.shutdown();}
  });
  await t.test('native import immediately changes existing bearer and Test mode without reentry or saved-state edits',async()=>{
   const person=await login('suffix-mode','abc'),created=await services.participantRuntime.launch({participantSessionId:person.participantSessionId,bookletKey:'owned'});
   const before=await repository.getTestRunById(created.testRunId),parentBefore=await get(person.participantSessionId),entry=entries.find(entry=>entry[0]==='suffix-mode');
   const bearer=await services.participantAccess.issueCredential({participantSessionId:person.participantSessionId});
   const bindingBefore=await repository.listOriginalLoginBindingsByWorkspace(tenant.tenantId,workspace.workspaceId),peerBefore=await get(first.participantSessionId);
   entry[1]='run-review';await upload('ORACLE.PERSON',['suffix-mode']);
   try{
    const authorized=await services.participantAccess.authorize({participantSessionId:person.participantSessionId,sessionToken:bearer});assert.equal(authorized.executionMode,'run-review');
    const runtime=await services.participantRuntime.getRuntimeState({participantSessionId:person.participantSessionId});
    assert.equal(runtime.executionMode.mode,'run-review');assert.equal(runtime.latestTestRun.testRunId,created.testRunId);assert.equal(runtime.latestTestRun.executionMode,'run-review');
    assert.deepEqual(await repository.listOriginalLoginBindingsByWorkspace(tenant.tenantId,workspace.workspaceId),bindingBefore);
    assert.deepEqual(await get(first.participantSessionId),peerBefore);
    const afterImport=await repository.getTestRunById(created.testRunId);assert.deepEqual({...afterImport,executionMode:before.executionMode},before);
    await repository.saveTestRun(before);assert.equal((await repository.getTestRunById(created.testRunId)).executionMode,'run-review','A stale ordinary Test save cannot restore the preceding Login mode');
    const review=await login('suffix-mode','ABC');assert.equal(review.participantSessionId,person.participantSessionId);assert.equal(review.executionMode,'run-review');
    assert.deepEqual({...review,executionMode:parentBefore.executionMode},parentBefore);
    const after=await repository.getTestRunById(created.testRunId);assert.equal(after.executionMode,'run-review');assert.deepEqual({...after,executionMode:before.executionMode},before);
    await repository.saveParticipantSession(parentBefore);assert.equal((await get(person.participantSessionId)).executionMode,'run-review','A stale ordinary parent save cannot restore the preceding Login mode');
   }finally{entry[1]='run-hot-return';await upload('ORACLE.PERSON',['suffix-mode']);}
   assert.equal((await services.participantRuntime.getRuntimeState({participantSessionId:person.participantSessionId})).executionMode.mode,'run-hot-return');
   assert.deepEqual(await repository.getTestRunById(created.testRunId),before);
  });
  if(kind==='sqlite'||kind==='postgres')await t.test('native SQL mode publication does not decode private response payloads',async()=>{
   const person=await login('suffix-mode','abc'),stored=(await repository.listTestRunsByParticipantSessionId(person.participantSessionId))[0],entry=entries.find(entry=>entry[0]==='suffix-mode');
   const marker='owned-mode-private-'+randomUUID(),payload=JSON.stringify({opaque:marker}),original=JSON.stringify(stored.unitResponses??{});
   control=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()});
   const write=payload=>kind==='sqlite'?control.prepare('UPDATE test_runs SET unit_responses_json=? WHERE test_run_id=?').run(payload,stored.testRunId):control.query('UPDATE test_runs SET unit_responses_json=$1::jsonb WHERE test_run_id=$2',[payload,stored.testRunId]);
   const raw=async()=>kind==='sqlite'?control.prepare('SELECT execution_mode,unit_responses_json AS payload FROM test_runs WHERE test_run_id=?').get(stored.testRunId):(await control.query('SELECT execution_mode,unit_responses_json::text AS payload FROM test_runs WHERE test_run_id=$1',[stored.testRunId])).rows[0];
   const parse=JSON.parse,pgParse=pgTypes.getTypeParser(3802,'text');
   await write(payload);const before=await raw();
   const rejectPrivate=read=>value=>{if(typeof value==='string'&&value.includes(marker))throw Error('Private responses must not be decoded for a Login mode change');return read(value);};
   try{
    JSON.parse=rejectPrivate(parse);if(kind==='postgres')pgTypes.setTypeParser(3802,'text',rejectPrivate(pgParse));
    await assert.rejects(repository.getTestRunById(stored.testRunId),/Private responses must not be decoded for a Login mode change/);
    entry[1]='run-review';await upload('ORACLE.PERSON',['suffix-mode']);
    const after=await raw();assert.equal(after.execution_mode,'run-review');assert.equal(after.payload,before.payload);
   }finally{
    JSON.parse=parse;pgTypes.setTypeParser(3802,'text',pgParse);
    entry[1]='run-hot-return';await upload('ORACLE.PERSON',['suffix-mode']);await write(original);
    if(kind==='sqlite')control.close();else await control.end();control=null;
   }
  });
  await t.test('fresh reservations and delayed ordinary saves use the current native parent mode while legacy Runs keep their contract',async()=>{
   const person=await login('suffix-live-fresh','abc'),template=await repository.getTestRunById(run.testRunId),entry=entries.find(entry=>entry[0]==='suffix-live-fresh');
   const canonical={...person,participantSessionId:randomUUID()};delete canonical.originalLoginKey;delete canonical.originalNameSuffix;await repository.saveParticipantSession(canonical);
   const canonicalRun={...template,testRunId:randomUUID(),participantSessionId:canonical.participantSessionId,executionMode:'run-hot-return'};await repository.saveTestRun(canonicalRun);
   const stale={...template,testRunId:randomUUID(),participantSessionId:person.participantSessionId,executionMode:'run-hot-return'};
   entry[1]='run-review';await upload('ORACLE.PERSON',['suffix-live-fresh']);
   try{
    const created=await repository.getOrCreateTestRunForAssignment(stale,context=>{
     assert.equal(context.testRun.executionMode,'run-review');assert.equal(context.participantSession.executionMode,'run-review');
     return {testRun:context.testRun,testLogs:[],activityEvents:[]};
    });
    assert.equal(created.created,true);assert.equal(created.testRun.executionMode,'run-review');
    await repository.saveTestRun(stale);assert.equal((await repository.getTestRunById(stale.testRunId)).executionMode,'run-review');
    assert.equal((await repository.getParticipantSessionById(canonical.participantSessionId)).executionMode,'run-hot-return');
    assert.equal((await repository.getTestRunById(canonicalRun.testRunId)).executionMode,'run-hot-return');
    await repository.saveTestRun({...canonicalRun,executionMode:'run-demo'});assert.equal((await repository.getTestRunById(canonicalRun.testRunId)).executionMode,'run-demo');
   }finally{entry[1]='run-hot-return';await upload('ORACLE.PERSON',['suffix-live-fresh']);}
  });
  await t.test('a fresh always-new suffix collision allocates another person instead of aliasing or overwriting its winner',async()=>{
   const winner=await login('restart-coded','abc'),before=await get(winner.participantSessionId);
   const next=await repository.resolveOriginalParticipantSession({...winner,participantSessionId:randomUUID()});
   assert.equal(next.created,true);assert.notEqual(next.participantSession.participantSessionId,winner.participantSessionId);
   assert.notEqual(next.participantSession.originalNameSuffix,winner.originalNameSuffix);assert.match(next.participantSession.originalNameSuffix,/^abc\/[a-z0-9_-]{8}$/);
   assert.deepEqual(await get(winner.participantSessionId),before);
  });
  await t.test('Source62 mode cycling keeps its first plain person and projects current mode to every linked person and Test',async()=>{
   const sourceCycle=lifecycle.checks.find(row=>row.name==='native mode change to restart creates a new suffix while retaining the prior person Test');
   const sourceReturn=lifecycle.checks.find(row=>row.name==='native return mode reuses the first plain suffix instead of the latest restart person');
   const entry=entries.find(entry=>entry[0]==='suffix-cycle'),plain=await login('suffix-cycle','abc');
   const oldRun=await services.participantRuntime.launch({participantSessionId:plain.participantSessionId,bookletKey:'owned'}),oldBefore=await repository.getTestRunById(oldRun.testRunId);
   try{
    entry[1]=sourceCycle.secondMode;await upload('ORACLE.PERSON',['suffix-cycle']);
    const restarted=await login('suffix-cycle','abc');assert.notEqual(restarted.participantSessionId,plain.participantSessionId);
    assert.equal((await get(plain.participantSessionId)).executionMode,sourceCycle.secondMode);
    assert.deepEqual(await repository.getTestRunById(oldRun.testRunId),{...oldBefore,executionMode:sourceCycle.secondMode});
    const newRun=await services.participantRuntime.launch({participantSessionId:restarted.participantSessionId,bookletKey:'owned'}),newBefore=await repository.getTestRunById(newRun.testRunId);
    entry[1]=sourceCycle.firstMode;await upload('ORACLE.PERSON',['suffix-cycle']);const returned=await login('suffix-cycle','ABC');
    assert.equal(sourceReturn.testId,sourceReturn.originalTestId);assert.equal(returned.participantSessionId,plain.participantSessionId);
    assert.equal((await get(restarted.participantSessionId)).executionMode,sourceCycle.firstMode);
    assert.deepEqual(await repository.getTestRunById(oldRun.testRunId),oldBefore);
    assert.deepEqual(await repository.getTestRunById(newRun.testRunId),{...newBefore,executionMode:sourceCycle.firstMode});
    await repository.saveParticipantSession(restarted);assert.equal((await get(restarted.participantSessionId)).executionMode,sourceCycle.firstMode);
   }finally{entry[1]='run-hot-return';await upload('ORACLE.PERSON',['suffix-cycle']);await login('suffix-cycle','abc');}
  });
  if(kind==='file'||kind==='sqlite'||kind==='postgres')await t.test('late native roster mode publication failure rolls back roster, parents and all Test metadata',async()=>{
   const person=await login('suffix-cycle','abc'),before=await repository.listParticipantSessionsByWorkspace(tenant.tenantId,workspace.workspaceId),cohort=before.filter(p=>p.loginKey==='suffix-cycle'),entry=entries.find(entry=>entry[0]==='suffix-cycle');
   const readRuns=async()=> (await Promise.all(cohort.map(p=>repository.listTestRunsByParticipantSessionId(p.participantSessionId)))).flat().sort((a,b)=>a.testRunId.localeCompare(b.testRunId)),runsBefore=await readRuns();
   const rosterBefore=await repository.listParticipantRosterEntriesByWorkspace(tenant.tenantId,workspace.workspaceId);
   entry[1]='run-hot-restart';
   let restore;
   if(kind==='file'){
    const backup=file+'.mode-backup';await rename(file,backup);await mkdir(file);
    restore=async()=>{await rm(file,{recursive:true,force:true});await rename(backup,file);};
   }else{
    control=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()});
    const execute=sql=>kind==='sqlite'?control.exec(sql):control.query(sql);
    await execute(kind==='sqlite'?"CREATE TRIGGER owned_mode_fail BEFORE UPDATE OF execution_mode ON test_runs WHEN NEW.execution_mode='run-hot-restart' BEGIN SELECT RAISE(ABORT,'owned mode failure'); END;":"CREATE FUNCTION owned_mode_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.execution_mode='run-hot-restart' THEN RAISE EXCEPTION 'owned mode failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER owned_mode_fail BEFORE UPDATE OF execution_mode ON test_runs FOR EACH ROW EXECUTE FUNCTION owned_mode_fail();");
    restore=async()=>{await execute(kind==='sqlite'?'DROP TRIGGER owned_mode_fail':'DROP TRIGGER owned_mode_fail ON test_runs; DROP FUNCTION owned_mode_fail()');if(kind==='sqlite')control.close();else await control.end();control=null;};
   }
   try{
    await assert.rejects(upload('ORACLE.PERSON',['suffix-cycle']),kind==='file'?undefined:/owned mode failure/);
    assert.deepEqual(await repository.listParticipantSessionsByWorkspace(tenant.tenantId,workspace.workspaceId),before);assert.deepEqual(await readRuns(),runsBefore);
    assert.deepEqual(await repository.listParticipantRosterEntriesByWorkspace(tenant.tenantId,workspace.workspaceId),rosterBefore);
   }finally{await restore();}
   try{
    await upload('ORACLE.PERSON',['suffix-cycle']);const recovered=await login('suffix-cycle','ABC');assert.notEqual(recovered.participantSessionId,person.participantSessionId);assert.equal(recovered.executionMode,'run-hot-restart');
    assert.deepEqual((await readRuns()).map(run=>({...run,executionMode:'run-hot-return'})),runsBefore);
    for(const member of cohort)assert.equal((await get(member.participantSessionId)).executionMode,'run-hot-restart');
   }finally{entry[1]='run-hot-return';await upload('ORACLE.PERSON',['suffix-cycle']);await login('suffix-cycle','abc');}
  });
  await t.test('native reusable people retain first expiry; always-new people receive a fresh relative window',async()=>{
   const xml=`<Testtakers xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/testcenter-testtaker-xml/18.0"><Metadata/><Group id="OWNED.EXPIRY" label="Owned expiry" validFor="1"><Login name="suffix-expiry" pw="Owned-person-secret" mode="run-hot-return"><Booklet codes="AbC">owned</Booklet></Login><Login name="suffix-fresh-window" pw="Owned-person-secret" mode="run-hot-restart"><Booklet codes="AbC">owned</Booklet></Login></Group></Testtakers>`;
   await services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:xml});
   let point='2030-01-01T00:00:00.000Z';const clocked=createFirstSliceServices({repository,originalXmlSchemaValidator,requireLoginPassword:true,now:()=>point});
   const enter=name=>clocked.participantRuntime.signIn({...scope,loginKey:name,password:'Owned-person-secret',participantCode:'abc'});
   const fixed=await enter('suffix-expiry'),fresh=await enter('suffix-fresh-window');assert.equal(fixed.validUntil,'2030-01-01T00:01:00.000Z');
   point='2030-01-01T00:02:00.000Z';const before=await repository.listParticipantSessionsByWorkspace(tenant.tenantId,workspace.workspaceId);
   await assert.rejects(enter('suffix-expiry'),error=>error.errorCode==='participant_access_expired');
   assert.deepEqual(await repository.listParticipantSessionsByWorkspace(tenant.tenantId,workspace.workspaceId),before);
   const next=await enter('suffix-fresh-window');assert.notEqual(next.participantSessionId,fresh.participantSessionId);assert.equal(Date.parse(next.validUntil)-Date.parse(next.createdAt),60_000);assert.ok(Date.parse(next.createdAt)>=Date.parse(point));
   assert.deepEqual(await get(fixed.participantSessionId),fixed);assert.deepEqual(await get(fresh.participantSessionId),fresh);
  });
  if(kind==='postgres')await t.test('native workspace serialization permits runtime foreign-key activity while waiting for its locked parent',async()=>{
   const lock=await pool.connect();let active=false,outcome;
   try{
    await lock.query('BEGIN');active=true;await lock.query(`SET LOCAL search_path TO "${schema}"`);
    await lock.query('SELECT participant_session_id FROM participant_sessions WHERE participant_session_id=$1 FOR UPDATE',[first.participantSessionId]);
    const pid=(await lock.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    outcome=repository.resolveOriginalParticipantSession({...first,participantSessionId:randomUUID()}).then(value=>({value}),error=>({error}));
    const deadline=Date.now()+5000;let waiting=false;
    while(Date.now()<deadline){
     waiting=(await pool.query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND $1=ANY(pg_blocking_pids(pid))) AS blocked',[pid])).rows[0].blocked;
     if(waiting)break;await new Promise(done=>setTimeout(done,20));
    }
    assert.equal(waiting,true,'The resolver must reach its real parent-row lock before the activity write');
    await lock.query('INSERT INTO workspace_activity_events (activity_event_id,tenant_id,workspace_id,event_type,actor_id,subject_type,subject_id,occurred_at,summary,details_json) VALUES ($1,$2,$3,$4,NULL,$5,$6,$7,$8,$9)',[randomUUID(),tenant.tenantId,workspace.workspaceId,'owned_native_fk_witness','participant_session',first.participantSessionId,new Date().toISOString(),'Owned native FK concurrency witness','{}']);
    await lock.query('COMMIT');active=false;
    const result=await outcome;if(result.error)throw result.error;
    assert.equal(result.value.participantSession.participantSessionId,first.participantSessionId);assert.equal(result.value.created,false);
   }finally{if(active)await lock.query('ROLLBACK');lock.release();if(outcome)await outcome;}
  });
  if(kind==='postgres')await t.test('native roster mode publication waits for its real parent lock without blocking runtime foreign-key activity',async()=>{
   const lock=await pool.connect(),entry=entries.find(entry=>entry[0]==='coded');let active=false,outcome;
   try{
    await lock.query('BEGIN');active=true;await lock.query(`SET LOCAL search_path TO "${schema}"`);
    await lock.query('SELECT participant_session_id FROM participant_sessions WHERE participant_session_id=$1 FOR UPDATE',[first.participantSessionId]);
    const pid=(await lock.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    entry[1]='run-review';outcome=upload('ORACLE.PERSON',['coded']).then(value=>({value}),error=>({error}));
    const deadline=Date.now()+5000;let waiting=false;
    while(Date.now()<deadline){waiting=(await pool.query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND $1=ANY(pg_blocking_pids(pid))) AS blocked',[pid])).rows[0].blocked;if(waiting)break;await new Promise(done=>setTimeout(done,20));}
    assert.equal(waiting,true,'Mode import must reach the actual locked native parent');
    await lock.query('INSERT INTO workspace_activity_events (activity_event_id,tenant_id,workspace_id,event_type,actor_id,subject_type,subject_id,occurred_at,summary,details_json) VALUES ($1,$2,$3,$4,NULL,$5,$6,$7,$8,$9)',[randomUUID(),tenant.tenantId,workspace.workspaceId,'owned_native_mode_fk_witness','participant_session',first.participantSessionId,new Date().toISOString(),'Owned mode FK concurrency witness','{}']);
    await lock.query('COMMIT');active=false;const result=await outcome;if(result.error)throw result.error;
    assert.equal((await get(first.participantSessionId)).executionMode,'run-review');assert.equal((await repository.getTestRunById(run.testRunId)).executionMode,'run-review');
   }finally{
    if(active)await lock.query('ROLLBACK');lock.release();if(outcome)await outcome;
    entry[1]='run-hot-return';await upload('ORACLE.PERSON',['coded']);
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
    const sql='DROP TABLE original_test_numbers; DROP TABLE original_test_number_counter; ALTER TABLE test_runs DROP COLUMN response_part_types_json; DROP TABLE original_session_tokens; DROP INDEX participant_access_credentials_token_hash; ALTER TABLE participant_sessions DROP COLUMN original_name_suffix; DELETE FROM schema_migrations WHERE version>='+(kind==='sqlite'?69:63);
    if(kind==='sqlite'){control.exec(sql);control.close();}else{await control.query(sql);await control.end();}control=null;
   }
   await open();const legacy=await get(first.participantSessionId),{originalNameSuffix,...known}=before;assert.deepEqual(legacy,known);
   const reentry=await login('coded','ABC');assert.equal(reentry.participantSessionId,first.participantSessionId);assert.equal(reentry.originalNameSuffix,undefined);
   await assert.rejects(repository.saveParticipantSession({...legacy,originalNameSuffix:'abc'}),/must stay unknown/);
   assert.equal((await repository.listTestRunsByParticipantSessionId(first.participantSessionId))[0].testRunId,run.testRunId);
  });
 }finally{await storage?.shutdown();if(created)await pool.query(`DROP SCHEMA "${schema}" CASCADE`);await pool?.end();await rm(directory,{recursive:true,force:true});}
});
