import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {mkdtemp,rm,readFile,rename,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {Pool} from 'pg';
import {createFirstSliceServices,prepareOriginalLoginBinding} from '@testcenter-rewrite-app/application';
import {compileBookletRuntimePolicy} from '@testcenter-rewrite-app/contracts';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceStorage} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
import {prepareOriginalXmlSchemaValidator} from '../packages/application/dist/packages/application/src/original-xml-schema.js';
const originalXmlSchemaValidator=await prepareOriginalXmlSchemaValidator(resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE || '.data/original-xml-schemas'),process.env.FIRST_SLICE_XML_SCHEMA_DOWNLOAD!=='false');
const root=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-identities/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
const receipt=JSON.parse(await readFile(new URL('receipt.json',root),'utf8'));
const sourceCase=receipt.checks.find(row=>row.name.startsWith('case-equivalent group reentry'));
const sourceMove=receipt.checks.find(row=>row.name.startsWith('successful reentry moves existing'));

test('unchanged production Source47 proves retained person/Test identity with rotated bearer and distinct current/snapshot group names',async()=>{
 assert.equal(manifest.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');
 assert.equal(manifest.probeCommit,'06a4a878554f07b72c968f8be9f168edd3d1c6d6');
 assert.equal(manifest.runId,40041716400);assert.equal(manifest.conclusion,'success');assert.equal(manifest.testMode,false);
 assert.equal(Object.keys(manifest.files).length,13);assert.equal(receipt.success,true);assert.equal(receipt.testMode,false);assert.equal(receipt.checks.length,47);
 for(const [name,sha]of Object.entries(manifest.files)){
  assert.match(name,/^[a-z0-9][a-z0-9.-]*$/);assert.equal(createHash('sha256').update(await readFile(new URL(name,root))).digest('hex'),sha,name);
 }
 for(const row of [sourceCase,sourceMove]){assert.equal(row.personIdentityRetained,true);assert.equal(row.personTokenRotated,true);assert.equal(row.testId,20);}
 assert.equal(sourceCase.result.groupName,'oracle.identity');assert.equal(sourceCase.testSession.groupName,'ORACLE.IDENTITY');
 assert.equal(sourceCase.result.groupLabel,'  Identity original Ω  ');assert.equal(sourceMove.result.groupName,'ORACLE.MOVED');
 assert.equal(sourceMove.result.groupLabel,'  Moved current Ω  ');assert.equal(sourceMove.testSession.bookletLabel,'Owned booklet A');
});
const stamp=n=>new Date(Date.parse('2026-10-24T10:00:00Z')+n*60000).toISOString();
test('actual Source native Login protocol proves exact principal isolation and keeps later protocol gaps visible',async()=>{
 const root=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-login-protocol/',import.meta.url);
 const manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
 assert.equal(manifest.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');assert.equal(manifest.runId,40063392830);
 assert.equal(manifest.head,'0a81b3bf5e8cbe6a112c7d7092e1c5d4b488ce03');assert.equal(manifest.testMode,false);
 assert.equal(manifest.artifact.bytes,7228);assert.equal(manifest.artifact.sha256,'8e4a14425ced1657e2c5076010ea1cf636ae50f049ce1dd1f3245fad332a0cce');
 assert.equal(Object.keys(manifest.files).length,4);
 for(const [name,sha]of Object.entries(manifest.files)){
  assert.match(name,/^[a-z0-9][a-z0-9.-]*$/);assert.equal(createHash('sha256').update(await readFile(new URL(name,root))).digest('hex'),sha,name);
 }
 const receipt=JSON.parse(await readFile(new URL('receipt.json',root),'utf8'));
 assert.equal(receipt.success,true);assert.equal(receipt.checks.length,21);assert.equal(receipt.testMode,false);
 assert.deepEqual(receipt.sourceFiles,manifest.sourceFiles);assert.equal(Object.keys(receipt.sourceFiles).length,11);
 const cases=receipt.checks.filter(row=>row.name.startsWith('exact native Login identity is isolated for '));
 const names=['owned-native-binary-login','OWNED-native-binary-login','owned-native-Ä-login','owned-native-ä-login','owned-native-é-login','owned-native-e\u0301-login'];
 assert.deepEqual(cases.map(row=>row.loginName),names);assert.equal(new Set(cases.map(row=>row.testId)).size,6);
 for(const row of cases){assert.equal(row.accessSet.loginName,row.loginName);assert.match(row.accessSet.token,/^\[redacted-owned-token-\d+\]$/);}
 const login=receipt.checks.find(row=>row.name.startsWith('coded credential phase')).accessSet;
 assert.deepEqual(login.flags,['codeRequired']);assert.deepEqual(login.claims,{});assert.deepEqual(login.access,{});
 const live=receipt.checks.find(row=>row.name.startsWith('already-open native person observes imported review mode'));
 assert.equal(live.testMode,'run-review');assert.deepEqual(live.accessSet.claims.review,[]);
 assert.equal(receipt.checks.at(-1).testSessions.length,7);
 const observations=JSON.parse(await readFile(new URL('http-observations.json',root),'utf8'));assert.equal(observations.length,83);
 for(const row of observations)if(row.value&&typeof row.value==='object')for(const key of ['token','groupToken']){
  if(typeof row.value[key]==='string')assert.match(row.value[key],/^\[redacted-owned-token-\d+\]$/);
 }
});
const kinds=['memory','file','sqlite'];
if(process.env.FIRST_SLICE_STORE==='postgres'){assert.ok(process.env.FIRST_SLICE_POSTGRES_URL);kinds.push('postgres');}
for(const kind of kinds)test(`${kind}: validated native login moves all existing people atomically without changing Test data`,async t=>{
 const directory=await mkdtemp(join(tmpdir(),'owned-native-identity-')),file=join(directory,kind==='file'?'state.json':'state.sqlite');
 const schema='owned_identity_'+randomUUID().replaceAll('-',''),url=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;
 url?.searchParams.set('options','-c search_path='+schema);
 let storage,repository,pool,control,created=false,clock=0;
 const open=async()=>{storage=kind==='memory'?storage??{repository:createInMemoryFirstSliceRepository(),shutdown:async()=>{}}
  :kind==='file'?await createFileFirstSliceStorage(file):kind==='sqlite'?await createSqliteFirstSliceStorage(file):await createPostgresFirstSliceStorage(url.toString());repository=storage.repository;};
 const service=()=>createFirstSliceServices({repository,now:()=>stamp(clock),requireLoginPassword:true,originalXmlSchemaValidator});
 try{
  if(url){pool=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await pool.query(`CREATE SCHEMA "${schema}"`);created=true;}
  await open();
  const tenant=await service().platform.createTenant({tenantKey:'owned-'+randomUUID(),displayName:'Owned identity'});
  const workspace=await service().platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'owned',displayName:'Owned identity'});
  const scope={tenantId:tenant.tenantId,workspaceId:workspace.workspaceId},release=randomUUID();
  await repository.saveContentRelease({...scope,contentReleaseId:release,importJobId:release,releaseLabel:'Owned fixed release',status:'active',createdAt:stamp(0),activatedAt:stamp(0),
   runtimeSnapshot:{bookletEntries:[{bookletKey:'owned',displayLabel:'Owned booklet A',policy:compileBookletRuntimePolicy({}),testletEntries:[],unitEntries:[{unitKey:'unit',displayLabel:'Owned unit',testletPath:[]}]}]}});
  const foreign=await service().platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'foreign',displayName:'Owned foreign identity'});
  const legacy={...scope,workspaceId:foreign.workspaceId,participantSessionId:randomUUID(),contentReleaseId:release,loginKey:'owned-native-identity',groupKey:'Legacy unknown',participantCode:null,executionMode:'run-hot-return',status:'signed_in',validUntil:null,createdAt:stamp(0)};
  await repository.saveParticipantSession(legacy);
  await t.test('older manifests and schema upgrades preserve unknown person history without inferring a native binding',async()=>{
   if(kind==='file'){
    await storage.shutdown();const state=JSON.parse(await readFile(file,'utf8'));delete state.originalLoginBindings;
    const {writeFile}=await import('node:fs/promises');await writeFile(file,JSON.stringify(state));await open();
   }
   if(kind==='sqlite'||kind==='postgres'){
    await storage.shutdown();control=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()});
    const sql='ALTER TABLE test_runs DROP COLUMN response_part_types_json; DROP TABLE original_session_tokens; DROP INDEX participant_access_credentials_token_hash; DROP TABLE original_login_bindings; DROP INDEX participant_sessions_original_login; ALTER TABLE participant_sessions DROP COLUMN original_name_suffix; ALTER TABLE participant_sessions DROP COLUMN original_login_key; ALTER TABLE participant_roster_entries DROP COLUMN original_login_identity; DELETE FROM schema_migrations WHERE version>='+(kind==='sqlite'?68:62);
    if(kind==='sqlite'){control.exec(sql);control.close();}else{await control.query(sql);await control.end();}control=null;await open();
   }
   assert.deepEqual(await repository.getParticipantSessionById(legacy.participantSessionId),legacy);
   assert.deepEqual(await repository.listOriginalLoginBindingsByWorkspace(scope.tenantId,foreign.workspaceId),[]);
  });
  const document=(group,label)=>`<Testtakers xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/testcenter-testtaker-xml/18.0"><Metadata/><Group id="${group}" label="${label}"><Login name="owned-native-identity" pw="Owned-identity-secret" mode="run-hot-return"><Booklet codes="Alpha Beta">owned</Booklet></Login></Group></Testtakers>`;
  const upload=(group,label)=>service().workspaceAdminRead.importParticipantRoster({tenantKey:tenant.tenantKey,workspaceKey:'owned',rosterText:document(group,label)});
  const login=(participantCode='Alpha',extra={})=>service().participantRuntime.signIn({tenantKey:tenant.tenantKey,workspaceKey:'owned',loginKey:'owned-native-identity',password:'Owned-identity-secret',participantCode,...extra});
  const bindings=()=>repository.listOriginalLoginBindingsByWorkspace(scope.tenantId,scope.workspaceId);
  const parents=()=>repository.listParticipantSessionsByWorkspace(scope.tenantId,scope.workspaceId);
  const groups=()=>repository.listOriginalParticipantGroupsByWorkspace(scope.tenantId,scope.workspaceId);
  let first,second,run,savedRun,initialBinding;
  await t.test('only validated XML carries provenance; invalid credentials cannot establish a binding',async()=>{
   await upload('ORACLE.IDENTITY','  Identity original Ω  ');
   assert.equal((await repository.listParticipantRosterEntriesByWorkspace(scope.tenantId,scope.workspaceId))[0].originalLoginIdentity,true);
   assert.deepEqual(await bindings(),[]);
   await assert.rejects(login('Alpha',{password:'wrong'}),e=>e.errorCode==='participant_password_invalid');assert.deepEqual(await bindings(),[]);
   clock=1;
   await assert.rejects(login(''),e=>e.errorCode==='participant_code_required');
   initialBinding=(await bindings())[0];assert.equal(initialBinding.groupKey,'ORACLE.IDENTITY');assert.equal(initialBinding.createdAt,stamp(1));
   await assert.rejects(login('invalid'),e=>e.errorCode==='participant_code_invalid');assert.deepEqual(await parents(),[]);
   first=await login();second=await login('Beta');assert.notEqual(first.participantSessionId,second.participantSessionId);
   run=await service().participantRuntime.launch({participantSessionId:first.participantSessionId,bookletKey:'owned'});
   savedRun={...run,unitResponses:{unit:'Exact saved Ä/β'},unitResponseFieldTimestamps:{unit:{opaque:123}}};await repository.saveTestRun(savedRun);
  });
  await t.test('case-only reentry retains both people, Test ID, opaque responses and Original clocks',async()=>{
   clock=2;await upload(sourceCase.result.groupName,'Replacement label');
   assert.equal((await repository.getParticipantSessionById(first.participantSessionId)).groupKey,'ORACLE.IDENTITY','import alone never moves people');
   const reentry=await login();assert.equal(reentry.participantSessionId,first.participantSessionId);assert.equal(reentry.groupKey,sourceCase.result.groupName);
   assert.equal((await bindings())[0].groupSnapshotKey,sourceCase.testSession.groupName);
   assert.equal((await groups())[0].groupLabel,sourceCase.result.groupLabel);
   assert.deepEqual(await repository.getTestRunById(run.testRunId),savedRun);
   assert.equal((await login('Beta')).participantSessionId,second.participantSessionId);
   assert.equal((await parents()).length,2);
  });
  await t.test('group move applies at credential step even when person code fails and preserves the frozen old group',async()=>{
   const oldGroup=(await groups())[0];clock=3;await upload(sourceMove.result.groupName,sourceMove.result.groupLabel);
   const before=await bindings();await assert.rejects(login('',{password:'wrong'}),e=>e.errorCode==='participant_password_invalid');assert.deepEqual(await bindings(),before);
   await assert.rejects(login('invalid'),e=>e.errorCode==='participant_code_invalid');
   assert.ok((await parents()).every(row=>row.groupKey===sourceMove.result.groupName));
   assert.equal((await login()).participantSessionId,first.participantSessionId);assert.equal((await login('Beta')).participantSessionId,second.participantSessionId);
   assert.equal((await bindings())[0].createdAt,initialBinding.createdAt);assert.equal((await bindings())[0].groupSnapshotKey,'ORACLE.MOVED');
   assert.deepEqual((await groups()).find(row=>row.groupKey===oldGroup.groupKey),oldGroup);
   assert.deepEqual(await repository.getTestRunById(run.testRunId),savedRun);
   const copied=await bindings();copied[0].groupKey='forged';assert.equal((await bindings())[0].groupKey,'ORACLE.MOVED');
  });
  await t.test('stale parent saves cannot undo a move, detach native identity or change its scope',async()=>{
   const {originalLoginKey,...stale}=first;await repository.saveParticipantSession(stale);
   const current=await repository.getParticipantSessionById(first.participantSessionId);assert.equal(current.originalLoginKey,originalLoginKey);assert.equal(current.groupKey,'ORACLE.MOVED');
   for(const patch of [{originalLoginKey:'foreign'},{workspaceId:'foreign'},{tenantId:'foreign'},{loginKey:'foreign'}])await assert.rejects(repository.saveParticipantSession({...current,...patch}),/login identity/);
   assert.equal((await repository.getParticipantSessionById(first.participantSessionId)).groupKey,'ORACLE.MOVED');
   await assert.rejects(repository.saveParticipantSession({...current,participantSessionId:randomUUID(),loginKey:'foreign'}),/scoped login binding/);
  });
  await t.test('forged JSON provenance cannot link a canonical person or move existing native people',async()=>{
   await service().workspaceAdminRead.importParticipantRoster({tenantKey:tenant.tenantKey,workspaceKey:'owned',rosterText:JSON.stringify([{loginKey:'canonical',password:'Owned-canonical-secret',groupKey:'Canonical',originalLoginIdentity:true,booklets:[{id:'owned'}]}])});
   const row=(await repository.listParticipantRosterEntriesByWorkspace(scope.tenantId,scope.workspaceId)).find(row=>row.loginKey==='canonical');assert.equal(row.originalLoginIdentity,undefined);
   const canonical=await service().participantRuntime.signIn({tenantKey:tenant.tenantKey,workspaceKey:'owned',loginKey:'canonical',password:'Owned-canonical-secret'});assert.equal(canonical.originalLoginKey,undefined);
   assert.equal((await bindings()).length,1);
  });
  await t.test('missing/foreign snapshots reject the move without changing binding or people',async()=>{
   const before=await bindings(),people=await parents();
   assert.equal(await repository.bindOriginalLoginGroup({...before[0],groupKey:'Missing',groupSnapshotKey:'Missing',authenticatedAt:stamp(4)}),null);
   assert.equal(await repository.bindOriginalLoginGroup({...before[0],tenantId:'foreign',authenticatedAt:stamp(4)}),null);
   await assert.rejects(repository.bindOriginalLoginGroup({...before[0],groupKey:'Other',authenticatedAt:stamp(4)}),/metadata/);
   assert.deepEqual(await bindings(),before);assert.deepEqual(await parents(),people);
  });
  const moveInput=async()=>{const group=await repository.getOrCreateOriginalParticipantGroup({...scope,groupKey:'Failed.Move',groupLabel:'Owned failure target',createdAt:stamp(4)});return {...scope,loginKey:first.originalLoginKey,groupKey:group.groupKey,groupSnapshotKey:group.groupKey,authenticatedAt:stamp(4)};};
  if(kind==='sqlite'||kind==='postgres')await t.test('late SQL failure rolls back the binding and every person; subsequent transaction succeeds',async()=>{
   const input=await moveInput(),before=await bindings(),people=await parents();control=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()});
   const execute=sql=>kind==='sqlite'?control.exec(sql):control.query(sql);
   try{
    await execute(kind==='sqlite'?"CREATE TRIGGER owned_move_fail BEFORE UPDATE OF group_key ON participant_sessions WHEN NEW.group_key='Failed.Move' BEGIN SELECT RAISE(ABORT,'owned late move failure'); END;":"CREATE FUNCTION owned_move_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.group_key='Failed.Move' THEN RAISE EXCEPTION 'owned late move failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER owned_move_fail BEFORE UPDATE OF group_key ON participant_sessions FOR EACH ROW EXECUTE FUNCTION owned_move_fail();");
    await assert.rejects(repository.bindOriginalLoginGroup(input),/owned late move failure/);assert.deepEqual(await bindings(),before);assert.deepEqual(await parents(),people);
    await execute(kind==='sqlite'?'DROP TRIGGER owned_move_fail':'DROP TRIGGER owned_move_fail ON participant_sessions; DROP FUNCTION owned_move_fail()');
    await repository.bindOriginalLoginGroup(input);assert.ok((await parents()).filter(row=>row.originalLoginKey).every(row=>row.groupKey==='Failed.Move'));
   }finally{if(kind==='sqlite')control.close();else await control.end();control=null;}
  });
  if(kind==='file')await t.test('failed durable move leaves cache and disk untouched',async()=>{
   const input=await moveInput(),before=await bindings(),people=await parents(),backup=file+'.backup';await rename(file,backup);await mkdir(file);
   try{await assert.rejects(repository.bindOriginalLoginGroup(input));assert.deepEqual(await bindings(),before);assert.deepEqual(await parents(),people);}
   finally{await rm(file,{recursive:true,force:true});await rename(backup,file);}
  });
  if(kind!=='memory')await t.test('native roster provenance, bindings, people and exact Test data survive reopening',async()=>{
   const before=await bindings(),people=await parents(),tests=await repository.listTestRunsByParticipantSessionId(first.participantSessionId);
   await storage.shutdown();await open();assert.deepEqual(await bindings(),before);assert.deepEqual(await parents(),people);assert.deepEqual(JSON.parse(JSON.stringify(await repository.listTestRunsByParticipantSessionId(first.participantSessionId))),JSON.parse(JSON.stringify(tests)));
   assert.equal((await repository.listParticipantRosterEntriesByWorkspace(scope.tenantId,scope.workspaceId)).find(row=>row.loginKey===first.loginKey).originalLoginIdentity,true);
  });
  await t.test('concurrent moves serialize into one binding and move every linked person together',async()=>{
   const targets=await Promise.all(['Concurrent.A','Concurrent.B'].map(groupKey=>repository.getOrCreateOriginalParticipantGroup({...scope,groupKey,groupLabel:groupKey,createdAt:stamp(5)})));
   await Promise.all(Array.from({length:8},(_,i)=>repository.bindOriginalLoginGroup({...scope,loginKey:first.originalLoginKey,groupKey:targets[i%2].groupKey,groupSnapshotKey:targets[i%2].groupKey,authenticatedAt:stamp(5)})));
   const current=(await bindings())[0];assert.equal((await bindings()).length,1);assert.ok((await parents()).filter(row=>row.originalLoginKey).every(row=>row.groupKey===current.groupKey));
   assert.equal((await parents()).find(row=>row.loginKey==='canonical').groupKey,'Canonical');
   assert.deepEqual(await repository.getParticipantSessionById(legacy.participantSessionId),legacy);
  });
  await t.test('binary native Login names isolate ASCII case, Unicode case and normalization peers with the same person code',async()=>{
   const json=value=>JSON.parse(JSON.stringify(value)); // Absent optional fields have one durable JSON representation.
   const names=['owned-native-binary-login','OWNED-native-binary-login','owned-native-Ä-login','owned-native-ä-login','owned-native-é-login','owned-native-e\u0301-login'];
   const password=index=>'Owned-binary-'+index+'-secret';
   const roster=selected=>`<Testtakers xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/testcenter-testtaker-xml/18.0"><Metadata/><Group id="ORACLE.BINARY.LOGINS" label="Owned exact Login names">${selected.map(name=>`<Login name="${name}" pw="${password(names.indexOf(name))}" mode="run-hot-return"><Booklet codes="Shared">owned</Booklet></Login>`).join('')}</Group></Testtakers>`;
   const upload=selected=>service().workspaceAdminRead.importParticipantRoster({tenantKey:tenant.tenantKey,workspaceKey:'owned',rosterText:roster(selected)});
   for(const name of names)await upload([name]);
   const signIn=(index,participantCode='Shared',extra={})=>service().participantRuntime.signIn({tenantKey:tenant.tenantKey,workspaceKey:'owned',loginKey:names[index],password:password(index),participantCode,...extra});
   const people=await Promise.all(names.map((_,index)=>signIn(index)));
   assert.equal(new Set(people.map(person=>person.participantSessionId)).size,names.length,'Each exact native Login owns a separate person, even with the same code');
   await upload(names);
   const tests=[];
   for(let index=0;index<names.length;index++){
    assert.equal(people[index].loginKey,names[index]);assert.equal(people[index].originalLoginKey,names[index]);
    const run=await service().participantRuntime.launch({participantSessionId:people[index].participantSessionId,bookletKey:'owned'});
    const saved=json({...run,unitResponses:{unit:'Exact private answer for '+names[index]}});await repository.saveTestRun(saved);tests.push(saved);
    await assert.rejects(signIn(index,'Shared',{password:password((index+1)%names.length)}),error=>error.errorCode==='participant_password_invalid');
   }
   assert.equal(new Set(tests.map(run=>run.testRunId)).size,names.length);
   for(let index=0;index<names.length;index++){
    const reentry=await signIn(index,'sHaReD');assert.equal(reentry.participantSessionId,people[index].participantSessionId);
    assert.equal(reentry.participantCode,'Shared');assert.equal(reentry.originalNameSuffix,'Shared');
    const current=await repository.listTestRunsByParticipantSessionId(reentry.participantSessionId);
    assert.equal(current.length,1);assert.deepEqual(json(current[0]),tests[index]);
   }
   const exactBindings=(await bindings()).filter(binding=>names.includes(binding.loginKey));
   assert.deepEqual(exactBindings.map(binding=>binding.loginKey).sort(),[...names].sort());
   for(const [left,right]of [[0,1],[2,3],[4,5]]){
    const previous=exactBindings.find(binding=>binding.loginKey===names[left]);
    assert.throws(()=>prepareOriginalLoginBinding({...previous,loginKey:names[right],authenticatedAt:stamp(5)},previous),/cannot change its identity/);
   }
   const priorRoster=await repository.listParticipantRosterEntriesByWorkspace(scope.tenantId,scope.workspaceId);
   await assert.rejects(service().workspaceAdminRead.importParticipantRoster({tenantKey:tenant.tenantKey,workspaceKey:'owned',rosterText:'loginKey,password,groupKey,displayName\nCanonical-Case,Owned-canonical-secret,canonical,First\ncanonical-case,Owned-canonical-secret,canonical,Second'}),error=>error.errorCode==='participant_roster_login_duplicate');
   await assert.rejects(upload([names[0],names[0]]));
   assert.deepEqual(await repository.listParticipantRosterEntriesByWorkspace(scope.tenantId,scope.workspaceId),priorRoster);
   const before=await repository.getParticipantSessionById(people[0].participantSessionId);
   const target=await repository.getOrCreateOriginalParticipantGroup({...scope,groupKey:'ORACLE.BINARY.MOVE',groupLabel:'Owned exact Login move',createdAt:stamp(5)});
   await repository.bindOriginalLoginGroup({...scope,loginKey:names[1],groupKey:target.groupKey,groupSnapshotKey:target.groupKey,authenticatedAt:stamp(5)});
   assert.deepEqual(await repository.getParticipantSessionById(people[0].participantSessionId),before,'Moving uppercase Login cannot move its lowercase peer');
   assert.equal((await repository.getParticipantSessionById(people[1].participantSessionId)).groupKey,target.groupKey);
   for(const run of tests)assert.deepEqual(json(await repository.getTestRunById(run.testRunId)),run);
   if(kind!=='memory'){
    await storage.shutdown();await open();
    const restored=(await bindings()).filter(binding=>names.includes(binding.loginKey));assert.equal(restored.length,names.length);
    for(const run of tests)assert.deepEqual(json(await repository.getTestRunById(run.testRunId)),run);
   }
  });
  await t.test('workspace cascade removes bindings and cannot recreate missing-workspace orphans',async()=>{
   const input={...(await bindings())[0],authenticatedAt:stamp(6)};
   await repository.deleteWorkspaceAggregate({...scope,tenantKey:tenant.tenantKey,workspaceKey:workspace.workspaceKey,auditEvent:{adminAuditEventId:randomUUID(),eventType:'workspace_deleted',actorAdminUserId:null,subjectAdminUserId:null,occurredAt:stamp(6),summary:'Owned deletion',details:{}}});
   assert.deepEqual(await bindings(),[]);assert.equal(await repository.bindOriginalLoginGroup(input),null);assert.deepEqual(await parents(),[]);assert.deepEqual(await repository.getParticipantSessionById(legacy.participantSessionId),legacy);
  });
 }finally{await storage?.shutdown();if(created)await pool.query(`DROP SCHEMA "${schema}" CASCADE`);await pool?.end();await rm(directory,{recursive:true,force:true});}
});
