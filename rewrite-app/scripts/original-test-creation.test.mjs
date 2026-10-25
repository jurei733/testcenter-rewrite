import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {mkdtemp, readFile, rm, rename, mkdir, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {Pool} from 'pg';
import {createFirstSliceServices, parseOriginalTestName, prepareOriginalTestNumber} from '@testcenter-rewrite-app/application';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceStorage} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage, SQLITE_FIRST_SLICE_SCHEMA_VERSION} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage, POSTGRES_FIRST_SLICE_SCHEMA_VERSION} from '@testcenter-rewrite-app/postgres-store';
import {prepareOriginalXmlSchemaValidator} from '../packages/application/dist/packages/application/src/original-xml-schema.js';
import {createProductionApiServer} from '../apps/api/dist/apps/api/src/index.js';

const evidence = new URL('../test-fixtures/original-testcenter/source-workspace-results/native-test-creation/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', evidence), 'utf8'));
const receipt = JSON.parse(await readFile(new URL('receipt.json', evidence), 'utf8'));
const checks = new Map(receipt.checks.map(row => [row.name, row]));
const native = checks.get('native Test PUT accepts a real workspace Booklet outside current assignments, returns raw decimal201 and leaves it unopened');
const names = checks.get('native Test PUT reuses case-equivalent and whitespace-normalized names while canonicalizing duplicate preset keys in first-key order');
const labels = checks.get('native Test PUT retains the first raw physical Booklet label and rejects a locked unopened Test before opening');
const removed = checks.get('native Test PUT resolves an already owned raw name before physical-file lookup but a normalization miss and new person require the current file');
const validator = await prepareOriginalXmlSchemaValidator(resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE || '.data/original-xml-schemas'), process.env.FIRST_SLICE_XML_SCHEMA_DOWNLOAD !== 'false');
const stamp = '2026-10-26T00:00:00.000Z', password = 'Owned-native-create-secret';
const schemas = {Unit:'unit-xml/17.6',Booklet:'testcenter-booklet-xml/18.0',Testtakers:'testcenter-testtaker-xml/18.0'};
const xml = (type, body) => `<${type} xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/${schemas[type]}">${body}</${type}>`;
const booklet = (id, label, timed = false) => xml('Booklet', `<Metadata><Id>${id}</Id><Label>${label}</Label></Metadata><Units>${timed?'<Testlet id="timed" label="Timed"><Restrictions><TimeMax minutes="1"/></Restrictions>':''}<Unit id="OWNED.NATIVE.UNIT" label="Owned Unit"/>${timed?'</Testlet>':''}</Units>`);
const denied = (status, code) => error => {assert.equal(error.statusCode, status); if(code) assert.equal(error.errorCode, code); return true;};

test('unchanged production Source33 qualifies the native creation boundary and retains every prior control', async () => {
  assert.equal(manifest.sourceCommit, 'eedae41840cbe90e5547c0211da818bdf620f5aa');
  assert.equal(manifest.probeCommit, '9009dcb83d05c356e26cb5816ed0e25b396ea8bc'); assert.equal(manifest.runId,40241983022);
  assert.equal(manifest.artifactSha256,'06ec057af193651d014f690f59bf1538882fce947dea18125790fe07c519c658');
  assert.equal(manifest.sourceProbeSha256,'30380b98c37dfad0f9dbb80961c12feaa08e5cd92cf029f2f50c8492ce742de0');
  assert.equal(receipt.success,true);assert.equal(receipt.testMode,false);assert.equal(receipt.checks.length,33);assert.equal(Object.keys(receipt.sourceFiles).length,26);
  assert.equal(manifest.preservedPriorGroups,28);assert.equal(manifest.preservedPriorAssertionLines,53);
  for(const [name,digest]of Object.entries(manifest.files)){assert.match(name,/^[a-z0-9][a-z0-9.-]*$/);assert.equal(createHash('sha256').update(await readFile(new URL(name,evidence))).digest('hex'),digest,name);}
  const probe=await readFile(new URL('source-probe.mjs',evidence),'utf8'),old=await readFile(new URL('../native-unit-reports/probe.mjs',evidence),'utf8');
  const previous=old.split('\n').filter(line=>line.trim().startsWith('assert.')),current=probe.split('\n').filter(line=>line.trim().startsWith('assert.'));
  let cursor=0;for(const line of previous){cursor=current.indexOf(line,cursor);assert.ok(cursor>=0,'Prior Source assertion removed');cursor++;}assert.equal(previous.length,53);
  const http=JSON.parse(await readFile(new URL('http-observations.json',evidence),'utf8'));assert.equal(http.length,188);
  assert.equal(native.body,String(native.testId));assert.equal(native.contentType,'text/html; charset=UTF-8');assert.equal(native.loginDenied,403);assert.equal(native.adminDenied,403);
  assert.equal(removed.retainedStatus,201);assert.equal(removed.whitespaceStatus,404);assert.equal(removed.newPersonStatus,404);
});

test('native TestName keeps Source whitespace, duplicate-key and first-key-order semantics without prototype assignment', () => {
  assert.equal(parseOriginalTestName(' \t'+names.presetInput+'\n ').name,names.presetCanonical);
  const parsed=parseOriginalTestName(' BOOK #2:first;1:other;2:last;__proto__:safe;x:a:b');
  assert.equal(parsed.name,'BOOK#2:last;1:other;__proto__:safe;x:a:b');assert.ok(Object.hasOwn(parsed.states,'__proto__'));assert.equal(parsed.states.__proto__,'safe');
  assert.equal(parseOriginalTestName('BOOK#').name,'BOOK');assert.equal(parseOriginalTestName('BOOK\u00a0').fileId,'BOOK\u00a0');
});

test('native Test numbers retain int64 precision, scope and sequence attempts', () => {
  const scope={testRunId:'r',participantSessionId:'p',tenantId:'t',workspaceId:'w',contentReleaseId:'c'};
  const run={...scope,originalResultState:{bookletName:'BOOK',bookletLabel:''}},person={...scope,originalLoginKey:'login',originalNameSuffix:''};
  const first=prepareOriginalTestNumber(scope,run,person,undefined,'9007199254740991');assert.equal(first.record.testNumber,'9007199254740992');
  const repeated=prepareOriginalTestNumber(scope,run,person,first.record,first.counter);assert.equal(repeated.changed,false);
  const attempted=prepareOriginalTestNumber({...scope,consumeSequence:true},run,person,first.record,first.counter);assert.equal(attempted.record.testNumber,first.record.testNumber);assert.equal(attempted.counter,'9007199254740993');
  for(const key of ['testRunId','participantSessionId','tenantId','workspaceId','contentReleaseId'])assert.throws(()=>prepareOriginalTestNumber({...scope,[key]:'foreign'},run,person,undefined,'0'),denied(409));
  assert.throws(()=>prepareOriginalTestNumber(scope,run,person,undefined,'9223372036854775807'),/exhausted/);
  assert.throws(()=>prepareOriginalTestNumber(scope,run,{...person,originalLoginKey:undefined},undefined,'0'),denied(409));
});

const kinds=['memory','file','sqlite'];if(process.env.FIRST_SLICE_STORE==='postgres'){assert.ok(process.env.FIRST_SLICE_POSTGRES_URL);kinds.push('postgres');}
for(const kind of kinds)test(`${kind}: real native Test creation is durable, scoped and separate from controller entry`,async t=>{
  const directory=await mkdtemp(join(tmpdir(),'owned-native-create-')),file=join(directory,kind==='file'?'state.json':'state.sqlite');
  const schema='owned_native_create_'+randomUUID().replaceAll('-',''),url=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;
  url?.searchParams.set('options','-c search_path='+schema);url?.searchParams.set('application_name',schema);
  let storage,repository,services,admin,control,created=false;
  const open=async()=>{storage=kind==='memory'?storage??{repository:createInMemoryFirstSliceRepository(),shutdown:async()=>{}}:kind==='file'?await createFileFirstSliceStorage(file):kind==='sqlite'?createSqliteFirstSliceStorage(file):await createPostgresFirstSliceStorage(url.toString());repository=storage.repository;services=createFirstSliceServices({repository,originalXmlSchemaValidator:validator,xmlSchemaProfile:'original-19'});};
  const close=async()=>{if(kind!=='memory'){const own=storage;storage=undefined;await own?.shutdown();}};
  const reopen=async()=>{await close();await open();};
  try{
    if(url){admin=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await admin.query(`CREATE SCHEMA "${schema}"`);created=true;}
    await open();
    const tenant=await services.platform.createTenant({tenantKey:'owned-'+randomUUID(),displayName:'Owned native create'});
    const workspace=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'owned',displayName:'Owned native create'});
    const scope={tenantKey:tenant.tenantKey,workspaceKey:workspace.workspaceKey},ids={tenantId:tenant.tenantId,workspaceId:workspace.workspaceId};
    const upload=(fileName,sourceDocument,mediaType='application/xml')=>services.contentIntake.uploadWorkspaceFile({...scope,fileName,sourceDocument,mediaType});
    await upload('player.html','<html><script type="application/ld+json">'+JSON.stringify({id:'owned-native-player',version:'1.2.3',specVersion:'6.0',metadataVersion:'2.0',type:'player',name:[{lang:'en',value:'Owned Player'}]})+'</script><main>Owned</main></html>','text/html');
    await upload('unit.xml',xml('Unit','<Metadata><Id>OWNED.NATIVE.UNIT</Id><Label>Owned Unit</Label></Metadata><Definition player="owned-native-player@1.2.3">Owned definition</Definition>'));
    await upload('assigned.xml',booklet('OWNED.ASSIGNED','Assigned',true));await upload('unassigned.xml',booklet(native.bookletName,labels.firstLabel));
    const namesOwned=['owned-create','owned-other','owned-entry','owned-atomic','owned-review','owned-after-delete','owned-legacy','owned-cross-writer'];
    await services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:xml('Testtakers','<Metadata/><Group id="Owned.Create" label="Owned create">'+namesOwned.map(name=>`<Login name="${name}" pw="${password}" mode="${name==='owned-review'?'run-review':'run-hot-return'}"><Booklet codes="Owned">OWNED.ASSIGNED</Booklet></Login>`).join('')+'</Group>')});
    const auth=async name=>{const login=await services.originalAuthentication.login({name,password});return{login,person:await services.originalAuthentication.person({loginToken:login.token,code:'Owned'})};};
    const main=await auth('owned-create'),other=await auth('owned-other');let number,run;
    const owned=person=>repository.listTestRunsByParticipantSessionId(person.participantSession.participantSessionId);
    const request=(session,bookletName)=>services.originalTest.create({token:session.person.token,bookletName});
    if(kind==='file')await t.test('an actual legacy File without native-number fields reopens without changing existing people',async()=>{
      const before=await repository.getParticipantSessionById(main.person.participantSession.participantSessionId);await close();
      const legacy=JSON.parse(await readFile(file,'utf8'));delete legacy.originalTestNumbers;delete legacy.originalTestNumberCounter;
      await writeFile(file,JSON.stringify(legacy));await open();
      assert.deepEqual(await repository.getParticipantSessionById(before.participantSessionId),before);assert.deepEqual(await owned(main.person),[]);
    });
    if(kind==='sqlite'||kind==='postgres')await t.test('migration from the real previous schema is atomic, preserves people and never invents old native IDs',async()=>{
      const version=kind==='sqlite'?SQLITE_FIRST_SLICE_SCHEMA_VERSION:POSTGRES_FIRST_SLICE_SCHEMA_VERSION;
      const before=await repository.getParticipantSessionById(main.person.participantSession.participantSessionId);await close();
      const connection=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()});
      const exec=sql=>kind==='sqlite'?connection.exec(sql):connection.query(sql),rows=async sql=>kind==='sqlite'?connection.prepare(sql).all():(await connection.query(sql)).rows;
      try{
        await exec(`DROP TABLE original_test_numbers; DROP TABLE original_test_number_counter; DELETE FROM schema_migrations WHERE version=${version}`);
        await exec(kind==='sqlite'?`CREATE TRIGGER owned_number_migration_failure BEFORE INSERT ON schema_migrations WHEN NEW.version=${version} BEGIN SELECT RAISE(ABORT,'owned number migration failure'); END`:
          `CREATE FUNCTION owned_number_migration_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned number migration failure'; END $$; CREATE TRIGGER owned_number_migration_failure BEFORE INSERT ON schema_migrations FOR EACH ROW WHEN (NEW.version=${version}) EXECUTE FUNCTION owned_number_migration_failure()`);
        try{
          await assert.rejects(async()=>open(),/owned number migration failure/);
          assert.equal(Number((await rows('SELECT MAX(version) AS version FROM schema_migrations'))[0].version),version-1);
          const tableQuery=kind==='sqlite'?"SELECT count(*) AS count FROM sqlite_master WHERE type='table' AND name IN ('original_test_numbers','original_test_number_counter')":
            "SELECT count(*) AS count FROM information_schema.tables WHERE table_schema=current_schema() AND table_name IN ('original_test_numbers','original_test_number_counter')";
          assert.equal(Number((await rows(tableQuery))[0].count),0);
        }finally{await exec(kind==='sqlite'?'DROP TRIGGER owned_number_migration_failure':'DROP TRIGGER owned_number_migration_failure ON schema_migrations; DROP FUNCTION owned_number_migration_failure()');}
        await open();assert.deepEqual(await repository.getParticipantSessionById(before.participantSessionId),before);
        assert.equal(Number((await rows('SELECT count(*) AS count FROM original_test_numbers'))[0].count),0);
        assert.equal((await rows('SELECT last_number FROM original_test_number_counter WHERE singleton=1'))[0].last_number,'0');
      }finally{if(kind==='sqlite')connection.close();else await connection.end();}
    });
    await t.test('an unassigned physical Booklet creates one unopened Test with first metadata and no state, logs, timer or result row',async()=>{
      number=await request(main,native.bookletName);assert.match(number,/^[1-9][0-9]*$/);
      [run]=await owned(main.person);assert.equal(run.status,'created');assert.equal(run.originalResultState.bookletName,native.bookletName);assert.equal(run.originalResultState.bookletLabel,labels.firstLabel);
      assert.equal(run.originalResultState.lastOpenedAt,null);assert.equal(run.originalResultState.hasTestState,false);assert.equal(run.controllerEntry,undefined);assert.deepEqual(run.testletTimers??{},{});assert.deepEqual(run.unitResponses,{});assert.equal(run.currentUnitKey,null);
      assert.equal((await repository.getParticipantSessionById(run.participantSessionId)).status,'signed_in');
      assert.deepEqual(await services.originalGroupResults.list(scope),[]);assert.deepEqual(await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId),[]);
      assert.ok(!(await services.originalSession.read({token:main.person.token})).claims.test.some(row=>row.id===native.bookletName));
      await assert.rejects(services.originalTest.create({token:main.login.token,bookletName:native.bookletName}),denied(403));
    });
    await t.test('repeated, case-equivalent and normalized attempts reuse the same number and preserve first metadata after restart',async()=>{
      for(const key of [native.bookletName,native.bookletName.toLowerCase(),' \t'+native.bookletName+' \n'])assert.equal(await request(main,key),number);
      const preset=await request(main,names.presetInput);assert.ok(BigInt(preset)>BigInt(number));assert.equal(await request(main,names.presetCanonical),preset);
      const before=await owned(main.person);await reopen();assert.equal(await request(main,native.bookletName),number);assert.deepEqual(await owned(main.person),before);
    });
    await t.test('different people get different numbers and stale/cross-scope number requests cannot mutate the owner',async()=>{
      const foreign=await request(other,native.bookletName);assert.notEqual(foreign,number);const before=await owned(main.person);
      for(const key of ['participantSessionId','tenantId','workspaceId','contentReleaseId'])await assert.rejects(repository.getOrCreateOriginalTestNumber({...run,[key]:'foreign'}));
      assert.deepEqual(await owned(main.person),before);
    });
    await t.test('current file replacement never rewrites first Test label and locked native creation returns 423',async()=>{
      await upload('unassigned.xml',booklet(native.bookletName,labels.replacementLabel));await repository.mutateParticipantRun(run,context=>({testRun:{...context.testRun,locked:true},testLogs:[],activityEvents:[]}));
      await assert.rejects(request(main,native.bookletName),error=>{assert.equal(error.statusCode,423);assert.ok(error.message.includes(labels.firstLabel));return true;});
      assert.equal((await repository.getTestRunById(run.testRunId)).originalResultState.bookletLabel,labels.firstLabel);
    });
    await t.test('raw existing-name lookup precedes physical-file lookup, while normalization misses require the current file',async()=>{
      const result=await upload('gone.xml',booklet(removed.removedBooklet,'Gone'));
      const gone=await request(main,removed.removedBooklet);
      await services.contentIntake.deleteSourcePackage({...scope,sourcePackageId:result.sourcePackage.sourcePackageId,confirmation:'Booklet/gone.xml'});
      assert.equal(await request(main,removed.removedBooklet.toLowerCase()),gone);
      await assert.rejects(request(main,' '+removed.removedBooklet+' '),denied(404));await assert.rejects(request(other,removed.removedBooklet),denied(404));
    });
    await t.test('native creation in review mode still exists, without manufacturing opened or saved state',async()=>{
      const review=await auth('owned-review'),id=await request(review,native.bookletName);assert.match(id,/^[1-9][0-9]*$/);
      const [saved]=await owned(review.person);assert.equal(saved.executionMode,'run-review');assert.equal(saved.originalResultState.lastOpenedAt,null);assert.equal(saved.originalResultState.hasTestState,false);
    });
    await t.test('a created native Test remains available and starts its real controller and timer only on canonical entry',async()=>{
      const entry=await auth('owned-entry');const id=await request(entry,'owned.assigned');const [before]=await owned(entry.person);
      assert.equal((await services.participantRuntime.getRuntimeState({participantSessionId:before.participantSessionId})).booklets[0].status,'available');
      assert.equal((await services.originalSession.read({token:entry.person.token})).claims.test[0].flags.running,false);
      const entries=await Promise.all(Array.from({length:8},()=>services.participantRuntime.launch({participantSessionId:before.participantSessionId,bookletKey:'OWNED.ASSIGNED'})));
      assert.equal(new Set(entries.map(row=>row.testRunId)).size,1);const opened=entries[0];
      assert.equal(opened.testRunId,before.testRunId);assert.equal(opened.status,'running');assert.equal(opened.currentUnitKey,'OWNED.NATIVE.UNIT');assert.equal(opened.controllerEntry.active,true);
      const logs=(await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId)).filter(row=>row.testRunId===opened.testRunId);
      for(const key of ['CONTROLLER','CURRENT_UNIT_ID','TESTLETS_TIMELEFT'])assert.equal(logs.filter(row=>row.logKey===key).length,1);
      const events=(await repository.listWorkspaceActivityEventsByWorkspace(ids.tenantId,ids.workspaceId)).filter(row=>row.subjectId===opened.testRunId);
      for(const type of ['testlet_timer_started','participant_session_resumed'])assert.equal(events.filter(row=>row.eventType===type).length,1);
      assert.equal(opened.testletTimers.timed.status,'running');assert.ok(opened.originalResultState.lastOpenedAt);assert.equal(opened.originalResultState.bookletName,'owned.assigned');
      assert.equal((await services.originalSession.read({token:entry.person.token})).claims.test[0].flags.running,true);assert.equal(await request(entry,'OWNED.ASSIGNED'),id);
    });
    await t.test('concurrent same-name requests reserve one Test and one stable number',async()=>{
      const simultaneous=await auth('owned-atomic');const values=await Promise.all(Array.from({length:12},(_,index)=>request(simultaneous,index%2?native.bookletName:native.bookletName.toLowerCase())));
      assert.equal(new Set(values).size,1);assert.equal((await owned(simultaneous.person)).length,1);
    });
    if(kind==='postgres')await t.test('independent real PostgreSQL writers agree on one unopened Test and numeric identity',async()=>{
      const session=await auth('owned-cross-writer'),second=await createPostgresFirstSliceStorage(url.toString());
      try{
        const secondary=createFirstSliceServices({repository:second.repository,originalXmlSchemaValidator:validator,xmlSchemaProfile:'original-19'});
        const values=await Promise.all(Array.from({length:16},(_,index)=>(index%2?services:secondary).originalTest.create({token:session.person.token,bookletName:index%3?native.bookletName:native.bookletName.toLowerCase()})));
        assert.equal(new Set(values).size,1);const runs=await owned(session.person);assert.equal(runs.length,1);assert.equal(runs[0].status,'created');
        assert.equal(await second.repository.getOrCreateOriginalTestNumber(runs[0]),values[0]);
      }finally{await second.shutdown();}
    });
    await t.test('generic Test deletion retires its number mapping without reusing the number for the same private UUID',async()=>{
      const session=await auth('owned-after-delete'),old=await request(session,native.bookletName),[saved]=await owned(session.person);
      await repository.deleteTestRunsByIds([saved.testRunId]);await repository.saveTestRun({...saved,originalResultState:{...saved.originalResultState,bookletName:'Recreated'}});
      const fresh=await repository.getOrCreateOriginalTestNumber(saved);assert.ok(BigInt(fresh)>BigInt(old));
    });
    if(kind==='sqlite'||kind==='postgres')await t.test('real protected native HTTP returns raw decimal HTML and rejects wrong roles before parsing the body',async()=>{
      const environment={FIRST_SLICE_STORE:kind,FIRST_SLICE_SQLITE_FILE:file,FIRST_SLICE_BOOTSTRAP_DEMO:'false',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',
        FIRST_SLICE_XML_SCHEMA_PROFILE:'original-19',FIRST_SLICE_PROOF_OF_WORK_SCOPES:'',...(url?{FIRST_SLICE_POSTGRES_URL:url.toString()}:{})};
      const previous=new Map(Object.keys(environment).map(key=>[key,process.env[key]]));let server;
      try{
        try{Object.assign(process.env,environment);server=await createProductionApiServer();}
        finally{for(const[key,value]of previous){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
        await new Promise(done=>server.listen(0,'127.0.0.1',done));const base='http://127.0.0.1:'+server.address().port;
        const call=async(method,token,body,status)=>{
          const response=await fetch(base+'/test',{method,headers:{...(token?{AuthToken:token}:{}),'content-type':'application/json'},...(body===undefined?{}:{body}),signal:AbortSignal.timeout(15000)});
          const text=await response.text();assert.equal(response.status,status,method+' /test: '+response.status);assert.equal(response.headers.get('cache-control'),'private, no-store');return{text,headers:response.headers};
        };
        const httpPerson=await auth('owned-atomic'),before=await owned(httpPerson.person);
        const initialized=await services.adminAuth.bootstrapAdminUser({username:'owned-native-admin',password});
        const adminToken=(await services.adminAuth.signIn({username:'owned-native-admin',password})).adminSession.token;
        await call('PUT',undefined,'{',401);await call('PUT',httpPerson.login.token,'{',403);
        await call('PUT',httpPerson.person.groupToken,'{',403);await call('PUT',adminToken,'{',403);
        await call('PUT','invalid-owned-token','{',401);await call('PUT',httpPerson.person.token,'{',400);
        for(const body of ['null','[]','{}','{"bookletName":1}'])await call('PUT',httpPerson.person.token,body,400);
        assert.deepEqual(await owned(httpPerson.person),before);
        const key=native.bookletName,expected=await request(httpPerson,key);
        const result=await call('PUT',httpPerson.person.token,JSON.stringify({bookletName:key,ignored:'owned'}),201);
        assert.equal(result.text,expected);assert.match(result.text,/^[1-9][0-9]*$/);assert.equal(result.headers.get('content-type'),'text/html; charset=UTF-8');
        assert.equal((await call('PUT',httpPerson.person.token,JSON.stringify({bookletName:key.toLowerCase()}),201)).text,expected);
        const wrong=await call('POST',httpPerson.person.token,'{}',405);assert.equal(wrong.headers.get('allow'),'PUT');
        await call('GET',httpPerson.person.token,undefined,405);await call('DELETE',adminToken,undefined,405);
        await call('PUT',httpPerson.person.token,JSON.stringify({bookletName:'OWNED.MISSING'}),404);
        assert.equal((await owned(httpPerson.person)).length,before.length);assert.equal(initialized.adminUser.username,'owned-native-admin');
      }finally{if(server)await new Promise((done,reject)=>server.close(error=>error&&error.code!=='ERR_SERVER_NOT_RUNNING'?reject(error):done()));}
    });
    if(kind==='file')await t.test('late File publication failure rolls back the new Test, number, first content binding and cache',async()=>{
      const session=await auth('owned-legacy'),before=await repository.getParticipantSessionById(session.person.participantSession.participantSessionId),backup=file+'.owned-backup';
      await rename(file,backup);await mkdir(file);
      try{await assert.rejects(request(session,native.bookletName));assert.deepEqual(await owned(session.person),[]);assert.deepEqual(await repository.getParticipantSessionById(before.participantSessionId),before);}
      finally{await rm(file,{recursive:true});await rename(backup,file);}
      await reopen();assert.deepEqual(await owned(session.person),[]);assert.match(await request(session,native.bookletName),/^[1-9][0-9]*$/);
    });
    if(kind==='sqlite'||kind==='postgres')await t.test('late number insertion failure rolls back the entire Test reservation, counter and parent content binding',async()=>{
      control=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()});const exec=sql=>kind==='sqlite'?control.exec(sql):control.query(sql);
      const session=await auth('owned-legacy'),before=await repository.getParticipantSessionById(session.person.participantSession.participantSessionId);
      await exec(kind==='sqlite'?"CREATE TRIGGER owned_number_failure BEFORE INSERT ON original_test_numbers BEGIN SELECT RAISE(ABORT,'owned native number failure'); END":"CREATE FUNCTION owned_number_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned native number failure'; END $$; CREATE TRIGGER owned_number_failure BEFORE INSERT ON original_test_numbers FOR EACH ROW EXECUTE FUNCTION owned_number_failure()");
      try{await assert.rejects(request(session,native.bookletName),/owned native number failure/);assert.deepEqual(await owned(session.person),[]);assert.deepEqual(await repository.getParticipantSessionById(before.participantSessionId),before);}
      finally{await exec(kind==='sqlite'?'DROP TRIGGER owned_number_failure':'DROP TRIGGER owned_number_failure ON original_test_numbers; DROP FUNCTION owned_number_failure()');}
      assert.match(await request(session,native.bookletName),/^[1-9][0-9]*$/);
    });
    await t.test('native group deletion retires number mappings while keeping the global number monotonic',async()=>{
      const before=await repository.getParticipantSessionById(run.participantSessionId),saved=await repository.getTestRunById(run.testRunId);
      await repository.deleteOriginalGroupResults({...ids,groups:['Owned.Create']});
      assert.equal(await repository.getTestRunById(run.testRunId),null);assert.equal(await repository.getParticipantSessionById(run.participantSessionId),null);
      await services.originalAuthentication.login({name:'owned-create',password});
      await repository.saveParticipantSession(before);await repository.saveTestRun(saved);
      const fresh=await repository.getOrCreateOriginalTestNumber(saved);assert.ok(BigInt(fresh)>BigInt(number));
    });
  }finally{await close();if(kind==='sqlite')control?.close();else await control?.end();if(admin){if(created)await admin.query(`DROP SCHEMA "${schema}" CASCADE`);await admin.end();}await rm(directory,{recursive:true,force:true});}
});
