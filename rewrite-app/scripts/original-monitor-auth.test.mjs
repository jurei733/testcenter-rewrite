import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import test from 'node:test';
import {Pool} from 'pg';
import {DatabaseSync} from 'node:sqlite';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceStorage} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
import {createProductionApiServer} from '../apps/api/dist/apps/api/src/index.js';
import {prepareOriginalXmlSchemaValidator} from '../packages/application/dist/packages/application/src/original-xml-schema.js';
const validator=await prepareOriginalXmlSchemaValidator(resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE||'.data/original-xml-schemas'),process.env.FIRST_SLICE_XML_SCHEMA_DOWNLOAD!=='false');
const evidence=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-test-command/',import.meta.url);
const http=JSON.parse(await readFile(new URL('http-observations.json',evidence),'utf8'));
const source=http.find(row=>row.method==='PUT'&&row.path==='/session'&&row.value?.loginName==='owned-native-command-monitor').value;
const publicAccess=value=>{const {token,groupToken,...rest}=value;return rest;};
const schemas={Unit:'unit-xml/17.6',Booklet:'testcenter-booklet-xml/18.0',Testtakers:'testcenter-testtaker-xml/18.0'};
const xml=(type,body)=>`<${type} xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/${schemas[type]}">${body}</${type}>`;
const esc=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const kinds=['memory','file','sqlite'];if(process.env.FIRST_SLICE_STORE==='postgres'){assert.ok(process.env.FIRST_SLICE_POSTGRES_URL);kinds.push('postgres');}
for(const kind of kinds)test(`${kind}: Source65 native monitor is an uncoded person with Test and group-monitor access, isolated from canonical identities`,async t=>{
 const dir=await mkdtemp(join(tmpdir(),'owned-monitor-auth-')),file=join(dir,kind==='file'?'state.json':'state.sqlite'),schema='owned_monitor_'+randomUUID().replaceAll('-','');
 const url=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;url?.searchParams.set('options','-c search_path='+schema);
 let storage,repository,services,pool,created=false,time=Date.parse('2026-10-28T08:00:00Z');
 const open=async()=>{storage=kind==='memory'?storage??{repository:createInMemoryFirstSliceRepository(),shutdown:async()=>{}}:kind==='file'?await createFileFirstSliceStorage(file):kind==='sqlite'?createSqliteFirstSliceStorage(file):await createPostgresFirstSliceStorage(url.toString());repository=storage.repository;services=createFirstSliceServices({repository,originalXmlSchemaValidator:validator,xmlSchemaProfile:'original-19',now:()=>new Date(time).toISOString(),participantLoginMaxFailures:3,participantLoginFailureWindowMs:60000});};
 const close=async()=>{const owned=storage;if(kind!=='memory')storage=undefined;await owned?.shutdown();};
 try{
  if(url){pool=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await pool.query(`CREATE SCHEMA "${schema}"`);created=true;}
  await open();const tenant=await services.platform.createTenant({tenantKey:'owned-'+randomUUID(),displayName:'Owned native monitor'}),workspace=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'owned',displayName:'Owned native monitor'});
  const scope={tenantKey:tenant.tenantKey,workspaceKey:workspace.workspaceKey},ids=[tenant.tenantId,workspace.workspaceId];
  const name=source.loginName,password='Owned monitor Ω & secret';let group='ORACLE.COMMAND',label=source.groupLabel;
  const document=(mode='monitor-group',pw=password)=>xml('Testtakers',`<Metadata/><Group id="${group}" label="${esc(label)}"><Login name="${name}" pw="${esc(pw)}" mode="${mode}"/><Login name="member" pw="Owned member" mode="run-hot-return"><Booklet codes="Secret AbC">ORACLE.POW.BOOK</Booklet></Login></Group>`);
  const upload=doc=>services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:doc});
  const login=(pw=password)=>services.originalAuthentication.login({name,password:pw});
  const read=token=>services.originalAuthentication.read({token});
  const privateRows=()=>repository.listOriginalOperationalLoginsByWorkspace(...ids),candidates=()=>repository.listOperationalLoginMigrationCandidatesByWorkspace(...ids);
  let first,last,number,run;
  await t.test('credential login requires no active release and issues a real reusable native person without participant mode or administrator promotion',async()=>{
   const admins=await repository.listAdminUsers();await upload(document());first=await login();last=first;
   assert.equal(first.kind,'person');assert.equal(first.participantSession.contentReleaseId,null);assert.equal(first.participantSession.originalOperationalMode,'monitor-group');assert.equal(first.participantSession.executionMode,undefined);
   assert.equal(first.participantSession.originalNameSuffix,'');assert.equal(first.participantSession.participantCode,'');assert.match(first.token,/^[a-z0-9_-]{24}$/);assert.match(first.groupToken,/^[a-z0-9_-]{24}$/);
   assert.deepEqual(await repository.listAdminUsers(),admins);assert.equal((await repository.listParticipantRosterEntriesByWorkspace(...ids)).length,1);
   assert.deepEqual(await repository.listTestRunsByParticipantSessionId(first.participantSession.participantSessionId),[]);
  });
  await t.test('restart preserves native mode and token, reentry reuses the person and rotates only its bearer',async()=>{
   await close();await open();assert.equal((await read(first.token)).participantSession.originalOperationalMode,'monitor-group');last=await login();assert.equal(last.participantSession.participantSessionId,first.participantSession.participantSessionId);assert.notEqual(last.token,first.token);assert.equal(last.groupToken,first.groupToken);await assert.rejects(read(first.token),e=>e.statusCode===401);
   assert.equal((await repository.listParticipantSessionsByWorkspace(...ids)).length,1);
  });
  if(kind==='sqlite'||kind==='postgres')await t.test('native mode upgrade rolls back atomically and preserves unknown history without inventing stored roles',async()=>{
   const before=await repository.getParticipantSessionById(last.participantSession.participantSessionId);delete before.originalOperationalMode;await close();
   const control=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()}),version=kind==='sqlite'?77:71;
   const exec=async sql=>kind==='sqlite'?control.exec(sql):control.query(sql);
   const columns=async()=>kind==='sqlite'?control.prepare('PRAGMA table_info(participant_sessions)').all().map(row=>row.name):(await control.query("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='participant_sessions'")).rows.map(row=>row.column_name);
   try{
    await exec(`ALTER TABLE participant_sessions DROP COLUMN original_operational_mode; DELETE FROM schema_migrations WHERE version>=${version}`);
    await exec(kind==='sqlite'?`CREATE TRIGGER owned_monitor_mode_failure BEFORE INSERT ON schema_migrations WHEN NEW.version=${version} BEGIN SELECT RAISE(ABORT,'owned monitor mode failure'); END`:`CREATE FUNCTION owned_monitor_mode_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned monitor mode failure'; END $$; CREATE TRIGGER owned_monitor_mode_failure BEFORE INSERT ON schema_migrations FOR EACH ROW WHEN (NEW.version=${version}) EXECUTE FUNCTION owned_monitor_mode_failure()`);
    await assert.rejects(open(),/owned monitor mode failure/);assert.equal((await columns()).includes('original_operational_mode'),false);
    await exec(kind==='sqlite'?'DROP TRIGGER owned_monitor_mode_failure':'DROP TRIGGER owned_monitor_mode_failure ON schema_migrations; DROP FUNCTION owned_monitor_mode_failure()');
   }finally{if(kind==='sqlite')control.close();else await control.end();}
   await open();assert.deepEqual(await repository.getParticipantSessionById(last.participantSession.participantSessionId),before);
   assert.equal((await read(last.token)).participantSession.originalOperationalMode,'monitor-group');assert.equal((await repository.getParticipantSessionById(last.participantSession.participantSessionId)).originalOperationalMode,undefined);
   last=await login();assert.equal(last.participantSession.participantSessionId,first.participantSession.participantSessionId);
  });
  await t.test('canonical participant sign-in, session access and runtime cannot reinterpret a monitor as a participant',async()=>{
   const id=last.participantSession.participantSessionId;
   await assert.rejects(services.participantAccess.authorize({participantSessionId:id,sessionToken:last.token}),e=>e.statusCode===403);
   await assert.rejects(services.participantRuntime.getRuntimeState({participantSessionId:id}),e=>e.statusCode===403);
   await assert.rejects(services.participantRuntime.signIn({...scope,loginKey:name,password}),e=>e.statusCode===403);
  });
  await t.test('actual physical files produce the exact measured Source65 dual AccessSet and collect coded group-member Booklets under empty code',async()=>{
   const uploadFile=(fileName,sourceDocument,mediaType='application/xml')=>services.contentIntake.uploadWorkspaceFile({...scope,fileName,sourceDocument,mediaType});
   await uploadFile('player.html','<html><script type="application/ld+json">'+JSON.stringify({id:'owned-monitor-player',version:'1.2.3',specVersion:'6.0',metadataVersion:'2.0',type:'player',name:[{lang:'en',value:'Owned Player'}]})+'</script><main>Owned</main></html>','text/html');
   await uploadFile('unit.xml',xml('Unit','<Metadata><Id>OWNED.MONITOR.UNIT</Id><Label>Owned Unit</Label></Metadata><Definition player="owned-monitor-player@1.2.3">Owned definition</Definition>'));
   await uploadFile('booklet.xml',xml('Booklet',`<Metadata><Id>ORACLE.POW.BOOK</Id><Label>${esc(source.claims.test[0].label)}</Label></Metadata><Units><Unit id="OWNED.MONITOR.UNIT" label="Owned Unit"/></Units>`));
   const access=await services.originalSession.read({token:last.token});assert.deepEqual(publicAccess(access),publicAccess(source));
   assert.deepEqual(access.flags,[]);assert.deepEqual(access.claims.testGroupMonitor[0].flags,[]);assert.deepEqual(access.access.test,['ORACLE.POW.BOOK']);
  });
  await t.test('the monitor owns real unopened Tests and reads its honest native mode without controller, timer or answer side effects',async()=>{
   number=await services.originalTest.create({token:last.token,bookletName:'ORACLE.POW.BOOK'});assert.match(number,/^[1-9][0-9]*$/);
   run=(await repository.listTestRunsByParticipantSessionId(last.participantSession.participantSessionId))[0];assert.equal(run.executionMode,undefined);assert.equal(run.originalResultState.lastOpenedAt,null);
   assert.deepEqual(run.unitResponses,{});assert.equal(run.controllerEntry,undefined);assert.deepEqual(Object.keys(run.testletTimers??{}),[]);
   const opened=await services.originalTest.read({token:last.token,testNumber:number});assert.equal(opened.mode,'monitor-group');assert.equal(opened.firstStart,true);assert.deepEqual(opened.laststate,{});
   const again=await services.originalTest.read({token:last.token,testNumber:number});assert.equal(again.firstStart,false);
   const access=await services.originalSession.read({token:last.token});assert.equal(access.claims.test[0].flags.running,true);assert.equal(access.claims.testGroupMonitor[0].id,group);
  });
  await t.test('native monitor ownership never authorizes another person\'s Test and canonical launch remains denied',async()=>{
   const member=await services.originalAuthentication.login({name:'member',password:'Owned member'});assert.equal(member.kind,'login');const person=await services.originalAuthentication.person({loginToken:member.token,code:'Secret'});
   await assert.rejects(services.originalTest.read({token:person.token,testNumber:number}),e=>e.statusCode===403);
   await assert.rejects(services.participantRuntime.launch({participantSessionId:last.participantSession.participantSessionId,bookletKey:'ORACLE.POW.BOOK'}),e=>e.statusCode===403);
  });
  if(kind==='sqlite'||kind==='postgres')await t.test('real production HTTP authenticates the monitor with configured proof of work and returns native own-Test mode',async()=>{
   const env={FIRST_SLICE_STORE:kind,FIRST_SLICE_SQLITE_FILE:file,FIRST_SLICE_BOOTSTRAP_DEMO:'false',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_XML_SCHEMA_PROFILE:'original-19',REQUIRE_LOGIN_PASSWORD:'false',FIRST_SLICE_PROOF_OF_WORK_SCOPES:'participant,second_code',FIRST_SLICE_PROOF_OF_WORK_SECRET:'owned-monitor-http-work-secret-not-production',FIRST_SLICE_PROOF_OF_WORK_PREVIOUS_SECRET:'',FIRST_SLICE_PROOF_OF_WORK_MAX_NUMBER:'12',FIRST_SLICE_PROOF_OF_WORK_TTL_MS:'60000',...(url?{FIRST_SLICE_POSTGRES_URL:url.toString()}:{})};
   const old=new Map(Object.keys(env).map(key=>[key,process.env[key]]));let server;
   try{
    try{Object.assign(process.env,env);server=await createProductionApiServer();}finally{for(const[key,value]of old)if(value===undefined)delete process.env[key];else process.env[key]=value;}
    await new Promise(done=>server.listen(0,'127.0.0.1',done));const base='http://127.0.0.1:'+server.address().port;
    const request=async(method,path,body,token,status=200)=>{
     const response=await fetch(base+path,{method,headers:{...(token?{AuthToken:token}:{}),...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
     const text=await response.text();assert.equal(response.status,status,method+' '+path);assert.equal(response.headers.get('cache-control'),'private, no-store');return text?JSON.parse(text):null;
    };
    await request('PUT','/session/login',{name,password},undefined,400);
    const challenge=await request('POST','/session/challenge',{loginType:'login',name,password});assert.equal(JSON.stringify(challenge).includes(password),false);
    let solution;for(let number=0;number<=challenge.maxNumber;number++)if(createHash('sha256').update(challenge.salt+number).digest('hex')===challenge.challenge){solution={algorithm:challenge.algorithm,challenge:challenge.challenge,salt:challenge.salt,signature:challenge.signature,number};break;}assert.ok(solution);
    await request('PUT','/session',{...solution,signature:'0'.repeat(64)},undefined,400);
    const access=await request('PUT','/session',solution);assert.deepEqual(access.access.testGroupMonitor,['ORACLE.COMMAND']);assert.deepEqual(access.claims.testGroupMonitor,source.claims.testGroupMonitor);assert.deepEqual(access.flags,[]);
    await request('PUT','/session',solution,undefined,409);assert.deepEqual(await request('GET','/session',undefined,access.token),access);
    assert.equal((await request('GET','/test/'+number,undefined,access.token)).mode,'monitor-group');
    await request('POST','/session/person/challenge',{},access.token,403);
    assert.equal((await request('GET','/session',undefined,access.groupToken,403)).includes(access.groupToken),false);
    last=await read(access.token);assert.equal(last.participantSession.participantSessionId,first.participantSession.participantSessionId);
   }finally{if(server)await new Promise((done,reject)=>server.close(error=>error?reject(error):done()));}
  });
  await t.test('password replacement preserves current person capabilities while genuine wrong credentials retain durable throttling',async()=>{
   await assert.rejects(login('wrong'),e=>e.statusCode===401);await assert.rejects(login('wrong'),e=>e.statusCode===401);await close();await open();assert.equal((await repository.getParticipantLoginAttempt(...ids,name)).failedAttempts,2);
   last=await login();assert.equal(await repository.getParticipantLoginAttempt(...ids,name),null);
   await upload(document('monitor-group','replacement'));assert.equal((await read(last.token)).participantSession.originalOperationalMode,'monitor-group');
   await assert.rejects(login(password),e=>e.statusCode===401);last=await login('replacement');
   for(let i=0;i<3;i++)await assert.rejects(login('wrong'),e=>e.statusCode===401);
   await assert.rejects(login('replacement'),e=>e.statusCode===429);time+=16*60*1000;last=await login('replacement');assert.equal(await repository.getParticipantLoginAttempt(...ids,name),null);
  });
  await t.test('current absolute and retained relative validity are enforced for native monitor tokens',async()=>{
   const rows=await candidates(),privateLogins=await privateRows();
   await repository.replaceOperationalLoginMigrationCandidatesByWorkspace(...ids,rows.map(row=>({...row,validTo:'2026-10-28T08:01:00Z'})),privateLogins);
   await assert.rejects(read(last.token),e=>e.statusCode===410);await repository.replaceOperationalLoginMigrationCandidatesByWorkspace(...ids,rows,privateLogins);
   assert.equal((await read(last.token)).kind,'person');
   const person=await repository.getParticipantSessionById(last.participantSession.participantSessionId);
   await repository.updateParticipantSessionValidity({...person,validUntil:new Date(time-1000).toISOString()});await assert.rejects(read(last.token),e=>e.statusCode===410);
   await repository.updateParticipantSessionValidity({...person,validUntil:person.validUntil});assert.equal((await read(last.token)).kind,'person');
  });
  await t.test('removing private provenance denies native tokens even if public candidates remain, restoring XML retains the actual person and Test',async()=>{
   const rows=await candidates();await repository.replaceOperationalLoginMigrationCandidatesByWorkspace(...ids,rows);await assert.rejects(read(last.token),e=>e.statusCode===410);await assert.rejects(login('replacement'),e=>e.statusCode===401);
   await upload(document());last=await login();assert.equal(last.participantSession.participantSessionId,first.participantSession.participantSessionId);assert.equal((await repository.listTestRunsByParticipantSessionId(last.participantSession.participantSessionId))[0].testRunId,run.testRunId);
  });
  await t.test('current group binding changes only after successful credential reentry; reads retain the credential group snapshot label',async()=>{
   const before=last;group='ORACLE.COMMAND.MOVED';label='  Moved monitor Ω  ';await upload(document());
   assert.equal((await services.originalSession.read({token:before.token})).groupLabel,source.groupLabel);
   last=await login();assert.notEqual(last.groupToken,before.groupToken);assert.equal(last.participantSession.groupKey,group);assert.equal((await services.originalSession.read({token:last.token})).groupLabel,label);
  });
  await t.test('current native participant/monitor role changes preserve Test evidence and stale saves cannot restore the preceding mode',async()=>{
   const personBefore=await repository.getParticipantSessionById(last.participantSession.participantSessionId),before=await repository.getTestRunById(run.testRunId);
   const evidence=value=>{const {executionMode,...rest}=value;return JSON.parse(JSON.stringify(rest));};
   await upload(document('run-hot-return'));
   const participant=await repository.getParticipantSessionById(personBefore.participantSessionId);assert.equal(participant.originalOperationalMode,undefined);assert.equal(participant.executionMode,'run-hot-return');
   assert.equal((await services.originalSession.read({token:last.token})).claims.testGroupMonitor,undefined);
   assert.equal((await services.participantAccess.authorize({participantSessionId:participant.participantSessionId,sessionToken:last.token})).executionMode,'run-hot-return');
   assert.deepEqual(evidence(await repository.getTestRunById(run.testRunId)),evidence(before));
   await repository.saveParticipantSession(personBefore);await repository.saveTestRun(before);
   assert.equal((await repository.getParticipantSessionById(participant.participantSessionId)).originalOperationalMode,undefined);assert.equal((await repository.getTestRunById(run.testRunId)).executionMode,'run-hot-return');
   await upload(document());assert.equal((await repository.getParticipantSessionById(participant.participantSessionId)).originalOperationalMode,'monitor-group');assert.equal((await repository.getTestRunById(run.testRunId)).executionMode,undefined);
   assert.deepEqual(evidence(await repository.getTestRunById(run.testRunId)),evidence(before));assert.equal((await services.originalSession.read({token:last.token})).claims.testGroupMonitor[0].id,group);
   await assert.rejects(services.participantAccess.authorize({participantSessionId:participant.participantSessionId,sessionToken:last.token}),e=>e.statusCode===403);
   await repository.saveParticipantSession(participant);assert.equal((await repository.getParticipantSessionById(participant.participantSessionId)).originalOperationalMode,'monitor-group');
  });
  await t.test('logout revokes the current person bearer, and concurrent monitor logins preserve one person identity',async()=>{
   await services.originalAuthentication.logout({token:last.token});await assert.rejects(read(last.token),e=>e.statusCode===401);
   const all=await Promise.all(Array.from({length:4},()=>login()));assert.equal(new Set(all.map(row=>row.participantSession.participantSessionId)).size,1);
   const valid=[];for(const row of all)try{await read(row.token);valid.push(row);}catch(error){assert.equal(error.statusCode,401);}assert.equal(valid.length,1);last=valid[0];
   assert.equal((await repository.listParticipantSessionsByWorkspace(...ids)).filter(row=>row.originalLoginKey===name).length,1);
  });
  await t.test('workspace deactivation and deletion invalidate native monitor access',async()=>{
   await repository.saveWorkspace({...scope,workspace:{...workspace,status:'archived'}});await assert.rejects(read(last.token),e=>e.statusCode===410);
   await repository.saveWorkspace({...scope,workspace});assert.equal((await read(last.token)).kind,'person');
   await repository.deleteWorkspaceAggregate({...scope,tenantId:ids[0],workspaceId:ids[1],auditEvent:{adminAuditEventId:randomUUID(),eventType:'workspace_deleted',actorAdminUserId:null,subjectAdminUserId:null,occurredAt:new Date(time).toISOString(),summary:'Owned deletion',details:{}}});await assert.rejects(read(last.token),e=>[401,410].includes(e.statusCode));
  });
 }finally{await close();if(created)await pool.query(`DROP SCHEMA "${schema}" CASCADE`);await pool?.end();await rm(dir,{recursive:true,force:true});}
});
