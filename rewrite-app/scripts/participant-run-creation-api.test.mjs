import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { Pool } from 'pg';
import { productionApiRoutes as routes, resolveRoutePath } from '@testcenter-rewrite-app/contracts';
import { createSqliteFirstSliceRepository } from '@testcenter-rewrite-app/sqlite-store';
import { createPostgresFirstSliceStorage } from '@testcenter-rewrite-app/postgres-store';
import { createProductionApiServer } from '../apps/api/dist/apps/api/src/index.js';
import { localDemoSourcePackage } from '../apps/api/dist/apps/api/src/local-demo-bootstrap.js';

const postgres = process.env.FIRST_SLICE_STORE === 'postgres';
test(`real ${postgres?'PostgreSQL':'SQLite'} fresh resume API rolls back failed initialization`, async t => {
  const directory = await mkdtemp(join(tmpdir(),'testcenter-run-creation-api-'));
  const file = join(directory,'owned.sqlite'), schema = 'owned_creation_api_'+randomUUID().replaceAll('-','');
  const environment = {FIRST_SLICE_STORE:postgres?'postgres':'sqlite',FIRST_SLICE_SQLITE_FILE:file,FIRST_SLICE_BOOTSTRAP_DEMO:'false',
    FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_XML_SCHEMA_PROFILE:'legacy-compatibility',FIRST_SLICE_PROOF_OF_WORK_SCOPES:'',REQUIRE_LOGIN_PASSWORD:'false'};
  let rootPool,storage,control,server,created=false;
  if(postgres) {
    assert.ok(process.env.FIRST_SLICE_POSTGRES_URL);
    const url=new URL(process.env.FIRST_SLICE_POSTGRES_URL);url.searchParams.set('options',`-c search_path=${schema}`);
    environment.FIRST_SLICE_POSTGRES_URL=url.toString();rootPool=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});
  }
  const execute=sql=>postgres?control.query(sql):control.exec(sql);
  const previous = new Map(Object.keys(environment).map(key=>[key,process.env[key]]));
  try {
    if(postgres){await rootPool.query(`CREATE SCHEMA "${schema}"`);created=true;}
    try{Object.assign(process.env,environment);server=await createProductionApiServer();}
    finally{for(const [key,value] of previous){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
    const repository = postgres ? (storage=await createPostgresFirstSliceStorage(environment.FIRST_SLICE_POSTGRES_URL)).repository : createSqliteFirstSliceRepository(file);
    control = postgres ? new Pool({connectionString:environment.FIRST_SLICE_POSTGRES_URL}) : new DatabaseSync(file);
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base=`http://127.0.0.1:${server.address().port}`;
    const request=async(method,path,body,token,expected=200)=>{
      const response=await fetch(base+path,{method,headers:{...(token?{authorization:`Bearer ${token}`} : {}),...(body!==undefined?{'content-type':'application/json'}:{})},
        ...(body!==undefined?{body:JSON.stringify(body)}:{})});
      const payload=await response.json();assert.equal(response.status,expected,`${method} ${path}: ${JSON.stringify(payload)}`);return payload;
    };
    const password='Owned-creation-API-2026!';
    await request('POST',routes.admin.bootstrap,{username:'owned-creation',password},undefined,201);
    const operator=(await request('POST',routes.admin.signIn,{username:'owned-creation',password})).sessionToken;
    const tenantKey='owned-creation',workspaceKey='owned';
    await request('POST',routes.platform.createTenant,{tenantKey,displayName:'Owned creation'},operator,201);
    await request('POST',resolveRoutePath(routes.workspace.createWorkspace,{tenantKey}),{workspaceKey,displayName:'Owned creation'},operator,201);
    const workspace=`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}`;
    const content=JSON.parse(localDemoSourcePackage.sourceDocument),bookletKey=content.bookletEntries[0].bookletKey;
    const source=await request('POST',workspace+'/source-packages',{fileName:'own-creation.json',mediaType:'application/json',contentStructure:content},operator,201);
    const imported=await request('POST',workspace+'/import-jobs',{sourcePackageId:source.sourcePackage.sourcePackageId},operator,201);
    await request('POST',workspace+`/content-releases/${imported.stagedContentRelease.contentReleaseId}/activate`,{activatedByActorId:'owned'},operator);
    await request('POST',workspace+'/participant-roster',{rosterText:JSON.stringify(['log','audit','activation','foreign','concurrent','browser-resume','browser-launch','browser-credentials','browser-invalid'].map(loginKey=>({
      loginKey,groupKey:'owned',executionMode:'run-hot-return',booklets:[{id:bookletKey}]})))},operator,201);
    const login=loginKey=>request('POST',routes.participant.signIn,{tenantKey,workspaceKey,loginKey});
    const snapshot=async identity=>{
      const parent=await repository.getParticipantSessionById(identity.participantSession.participantSessionId);
      return {parent,runs:await repository.listTestRunsByParticipantSessionId(parent.participantSessionId),
        logs:(await repository.listParticipantTestLogsByWorkspace(parent.tenantId,parent.workspaceId)).filter(log=>log.participantSessionId===parent.participantSessionId),
        events:(await repository.listWorkspaceActivityEventsByWorkspace(parent.tenantId,parent.workspaceId)).filter(event=>event.details.participantSessionId===parent.participantSessionId)};
    };
    const resume=(identity,expected=200)=>request('POST',resolveRoutePath(routes.participant.resumeSession,{participantSessionId:identity.participantSession.participantSessionId}),
      {bookletKey},identity.sessionToken,expected);
    const foreign=await login('foreign'),foreignBefore=await snapshot(foreign);
    await t.test('all three authenticated entry paths negotiate actual browser lifecycle logs without a synthetic ready state',async()=>{
      for(const path of ['resume','launch','credentials']){
        const identity=await login('browser-'+path),id=identity.participantSession.participantSessionId;
        const entered=path==='resume'?await request('POST',resolveRoutePath(routes.participant.resumeSession,{participantSessionId:id}),{bookletKey,controllerLifecycle:'browser-v1'},identity.sessionToken)
          :await request('POST',routes.participant.launch,{bookletKey,controllerLifecycle:'browser-v1',...(path==='launch'?{participantSessionId:id}:{tenantKey,workspaceKey,loginKey:'browser-credentials'})},path==='launch'?identity.sessionToken:undefined);
        const state=await snapshot(identity);assert.equal(entered.testRun.testRunId,state.runs[0].testRunId);assert.equal(state.parent.status,'launched');
        assert.equal(state.logs.filter(log=>log.logKey==='CONTROLLER').length,0);assert.equal(state.logs.filter(log=>log.logKey==='CURRENT_UNIT_ID').length,1);
        assert.equal(state.events.filter(event=>event.eventType==='participant_session_resumed').length,1);
      }
    });
    await t.test('invalid lifecycle cannot create or activate a Run through any entry path',async()=>{
      const identity=await login('browser-invalid'),id=identity.participantSession.participantSessionId,before=await snapshot(identity);
      for(const path of ['resume','launch','credentials']){
        const body={bookletKey,controllerLifecycle:'unsupported',...(path==='resume'?{}:path==='launch'?{participantSessionId:id}:{tenantKey,workspaceKey,loginKey:'browser-invalid'})};
        const result=await request('POST',path==='resume'?resolveRoutePath(routes.participant.resumeSession,{participantSessionId:id}):routes.participant.launch,body,path==='credentials'?undefined:identity.sessionToken,400);
        assert.equal(result.error,'participant_controller_lifecycle_invalid');assert.deepEqual(await snapshot(identity),before);
      }
    });

    for(const [name,table,operation] of [['log','participant_test_logs','INSERT'],['audit','workspace_activity_events','INSERT'],['activation','participant_sessions','UPDATE']]) {
      await t.test(`${name} failure returns 500 without partial initialization, then the same authenticated session starts exactly once`,async()=>{
        const identity=await login(name),before=await snapshot(identity),id=identity.participantSession.participantSessionId;
        const guard=table==='workspace_activity_events'?`NEW.event_type='participant_session_resumed' AND NEW.tenant_id='${before.parent.tenantId}'`:
          `NEW.participant_session_id='${id}'${operation==='UPDATE'?" AND NEW.status='launched'":''}`;
        await execute(postgres?`CREATE FUNCTION owned_creation_api_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned creation API failure'; END $$; CREATE TRIGGER owned_creation_api_failure BEFORE ${operation} ON ${table} FOR EACH ROW WHEN (${guard}) EXECUTE FUNCTION owned_creation_api_failure()`:
          `CREATE TRIGGER owned_creation_api_failure BEFORE ${operation} ON ${table} WHEN ${guard} BEGIN SELECT RAISE(ABORT,'owned creation API failure'); END`);
        try{const failed=await resume(identity,500);assert.equal(failed.error,'internal_server_error');assert.deepEqual(await snapshot(identity),before);}
        finally{await execute(postgres?`DROP TRIGGER owned_creation_api_failure ON ${table}; DROP FUNCTION owned_creation_api_failure()`:'DROP TRIGGER owned_creation_api_failure');}
        const resumed=await resume(identity),state=await snapshot(identity);
        assert.equal(state.runs.length,1);assert.equal(state.runs[0].testRunId,resumed.testRun.testRunId);assert.equal(state.parent.status,'launched');
        assert.equal(state.logs.filter(log=>log.logKey==='CONTROLLER').length,1);assert.equal(state.logs.filter(log=>log.logKey==='CURRENT_UNIT_ID').length,1);
        assert.equal(state.events.filter(event=>event.eventType==='participant_session_resumed').length,1);
        await resume(identity);assert.deepEqual(await snapshot(identity),state);
      });
    }
    await t.test('concurrent fresh resume requests keep one identity and one initial artifact set',async()=>{
      const identity=await login('concurrent'),results=await Promise.all(Array.from({length:6},()=>resume(identity))),state=await snapshot(identity);
      assert.equal(new Set(results.map(result=>result.testRun.testRunId)).size,1);assert.equal(state.runs.length,1);
      assert.equal(state.logs.filter(log=>log.logKey==='CONTROLLER').length,1);assert.equal(state.events.filter(event=>event.eventType==='participant_session_resumed').length,1);
    });
    assert.deepEqual(await snapshot(foreign),foreignBefore);
  } finally {
    if(server)await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
    if(postgres)await control?.end();else control?.close();
    await storage?.shutdown();if(created)await rootPool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await rootPool?.end();await rm(directory,{recursive:true,force:true});
  }
});
