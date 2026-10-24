import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
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
    FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_XML_SCHEMA_PROFILE:'original-19',FIRST_SLICE_PROOF_OF_WORK_SCOPES:'',REQUIRE_LOGIN_PASSWORD:'false'};
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
    await request('POST',workspace+'/participant-roster',{rosterText:JSON.stringify(['log','audit','activation','foreign','concurrent','browser-resume','browser-launch','browser-credentials','browser-invalid','result-clock','result-review'].map(loginKey=>({
      loginKey,groupKey:'owned',executionMode:loginKey==='result-review'?'run-review':'run-hot-return',booklets:[{id:bookletKey}]})))},operator,201);
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
    await t.test('protected credential API captures the authored group before code entry and rejects forged snapshot fields',async()=>{
      const scope=await repository.getWorkspaceByScope(tenantKey,workspaceKey);
      const importMetadata=label=>request('POST',workspace+'/participant-roster',{rosterText:JSON.stringify([{loginKey:'owned-metadata',password:'Owned-metadata-secret',
        groupKey:'Owned.Metadata',groupLabel:label,booklets:[{id:bookletKey,codes:'AbC'}]}])},operator,201);
      const metadata=async()=> (await repository.listOriginalParticipantGroupsByWorkspace(scope.tenantId,scope.workspaceId)).filter(group=>group.groupKey==='Owned.Metadata');
      await importMetadata('Before code');assert.deepEqual(await metadata(),[]);
      const input={tenantKey,workspaceKey,loginKey:'owned-metadata',password:'Owned-metadata-secret'};
      await request('POST',routes.participant.signIn,{...input,password:'wrong'},undefined,401);assert.deepEqual(await metadata(),[]);
      const before=Date.now();
      await request('POST',routes.participant.signIn,{...input,groupLabel:'forged',createdAt:'2099-01-01T00:00:00.000Z',lastModifiedAt:'2099-01-01T00:00:00.000Z'},undefined,409);
      const after=Date.now(),saved=(await metadata())[0];assert.equal(saved.groupLabel,'Before code');assert.equal(saved.lastModifiedAt,saved.createdAt);
      assert.ok(Date.parse(saved.createdAt)>=before&&Date.parse(saved.createdAt)<=after);
      assert.ok(!(await repository.listParticipantSessionsByWorkspace(scope.tenantId,scope.workspaceId)).some(session=>session.loginKey==='owned-metadata'));
      await importMetadata('After import');
      await request('POST',routes.participant.signIn,{...input,participantCode:'wrong'},undefined,400);assert.deepEqual(await metadata(),[saved]);
      const identity=await request('POST',routes.participant.signIn,{...input,participantCode:'abc'});
      assert.equal(identity.participantSession.participantCode,'AbC');assert.deepEqual(await metadata(),[saved]);
      await request('POST',routes.participant.signIn,{...input,participantCode:'ABC'});assert.deepEqual(await metadata(),[saved]);
    });
    await t.test('native group reentry keeps person and Test while rotating credentials and rejecting the old bearer',async()=>{
      const scope=await repository.getWorkspaceByScope(tenantKey,workspaceKey);
      const document=(group,label)=>`<Testtakers xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/testcenter-testtaker-xml/18.0"><Metadata/><Group id="${group}" label="${label}"><Login name="owned-native-http" pw="Owned-native-http-secret" mode="run-hot-return"><Booklet>${bookletKey}</Booklet></Login></Group></Testtakers>`;
      const upload=(group,label)=>request('POST',workspace+'/participant-roster',{rosterText:document(group,label)},operator,201);
      const input={tenantKey,workspaceKey,loginKey:'owned-native-http',password:'Owned-native-http-secret'};
      await upload('NATIVE.HTTP','  Original HTTP Ω  ');
      let current=await request('POST',routes.participant.signIn,input);
      const parentId=current.participantSession.participantSessionId;
      await resume(current);const testsBefore=await repository.listTestRunsByParticipantSessionId(parentId);
      assert.equal(testsBefore.length,1);
      const runtime=resolveRoutePath(routes.participant.getRuntimeState,{participantSessionId:parentId});
      for(const [group,label,snapshot] of [['native.http','Replacement label','NATIVE.HTTP'],['NATIVE.MOVED','  Moved HTTP Ω  ','NATIVE.MOVED']]){
        const previous=current;await upload(group,label);current=await request('POST',routes.participant.signIn,input);
        assert.equal(current.participantSession.participantSessionId,parentId);assert.equal(current.participantSession.groupKey,group);
        assert.notEqual(current.sessionToken,previous.sessionToken);
        await request('GET',runtime,undefined,previous.sessionToken,401);
        await request('GET',runtime,undefined,current.sessionToken);
        assert.deepEqual(await repository.listTestRunsByParticipantSessionId(parentId),testsBefore);
        const binding=(await repository.listOriginalLoginBindingsByWorkspace(scope.tenantId,scope.workspaceId)).find(row=>row.loginKey===input.loginKey);
        assert.equal(binding.groupSnapshotKey,snapshot);
      }
      assert.equal((await repository.listParticipantSessionsByWorkspace(scope.tenantId,scope.workspaceId)).filter(row=>row.loginKey===input.loginKey).length,1);
    });
    await t.test('native zero-only XML signs in without a code while mixed XML and canonical zero still require one',async()=>{
      const document=`<Testtakers xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/testcenter-testtaker-xml/18.0"><Metadata/><Group id="HTTP.NATIVE.ZERO" label="Native zero"><Login name="http-zero-alone" pw="Owned-zero-secret" mode="run-hot-return"><Booklet codes="0">${bookletKey}</Booklet></Login><Login name="http-zero-mixed" pw="Owned-zero-secret" mode="run-hot-return"><Booklet codes="0 AbC">${bookletKey}</Booklet></Login></Group></Testtakers>`;
      await request('POST',workspace+'/participant-roster',{rosterText:document},operator,201);
      const input={tenantKey,workspaceKey,loginKey:'http-zero-alone',password:'Owned-zero-secret'};
      const alone=await request('POST',routes.participant.signIn,input);
      assert.equal(alone.participantSession.participantCode??'','');assert.equal(alone.participantSession.originalNameSuffix,'');
      const mixedInput={...input,loginKey:'http-zero-mixed'};
      assert.equal((await request('POST',routes.participant.signIn,mixedInput,undefined,409)).error,'participant_code_required');
      const mixed=await request('POST',routes.participant.signIn,{...mixedInput,participantCode:'0'});
      assert.equal(mixed.participantSession.participantCode,'0');assert.equal(mixed.participantSession.originalNameSuffix,'');
      await request('POST',workspace+'/participant-roster',{rosterText:JSON.stringify([{loginKey:'http-zero-canonical',password:'Owned-zero-secret',booklets:[{id:bookletKey,codes:'0'}]}])},operator,201);
      const canonicalInput={...input,loginKey:'http-zero-canonical'};
      assert.equal((await request('POST',routes.participant.signIn,canonicalInput,undefined,409)).error,'participant_code_required');
      const canonical=await request('POST',routes.participant.signIn,{...canonicalInput,participantCode:'0'});
      assert.equal(canonical.participantSession.participantCode,'0');assert.equal(canonical.participantSession.originalNameSuffix,undefined);
    });
    await t.test('native HTTP concurrent first credentials resolve one person and rotate only that identity',async()=>{
      const doc=`<Testtakers xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/testcenter-testtaker-xml/18.0"><Metadata/><Group id="HTTP.SUFFIX" label="Native suffix"><Login name="http-suffix-race" pw="Owned-suffix-secret" mode="run-hot-return"><Booklet codes="AbC">${bookletKey}</Booklet></Login></Group></Testtakers>`;
      await request('POST',workspace+'/participant-roster',{rosterText:doc},operator,201);
      const input={tenantKey,workspaceKey,loginKey:'http-suffix-race',password:'Owned-suffix-secret'};
      const people=await Promise.all(Array.from({length:8},(_,index)=>request('POST',routes.participant.signIn,{...input,participantCode:index%2?'ABC':'abc'})));
      assert.equal(new Set(people.map(row=>row.participantSession.participantSessionId)).size,1);
      assert.equal(new Set(people.map(row=>row.sessionToken)).size,8);
      for(const row of people)assert.equal(row.participantSession.participantCode,people[0].participantSession.participantCode);
      const path=resolveRoutePath(routes.participant.getRuntimeState,{participantSessionId:people[0].participantSession.participantSessionId});
      const statuses=await Promise.all(people.map(async row=>(await fetch(base+path,{headers:{authorization:'Bearer '+row.sessionToken}})).status));
      assert.equal(statuses.filter(status=>status===200).length,1);assert.ok(statuses.every(status=>status===200||status===401));
    });
    await t.test('native HTTP preserves first raw code and durable suffix while canonical code normalization remains separate',async()=>{
      const document=`<Testtakers xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/testcenter-testtaker-xml/18.0"><Metadata/><Group id="HTTP.NATIVE.CODE" label="Native code"><Login name="http-native-coded" pw="Owned-native-code-secret" mode="run-hot-return"><Booklet codes="AbC">${bookletKey}</Booklet></Login><Login name="http-native-restart" pw="Owned-native-code-secret" mode="run-hot-restart"><Booklet codes="AbC">${bookletKey}</Booklet></Login></Group></Testtakers>`;
      await request('POST',workspace+'/participant-roster',{rosterText:document},operator,201);
      const input={tenantKey,workspaceKey,loginKey:'http-native-coded',password:'Owned-native-code-secret',participantCode:'abc',originalNameSuffix:'forged'};
      const first=await request('POST',routes.participant.signIn,input);
      assert.equal(first.participantSession.participantCode,'abc');assert.equal(first.participantSession.originalNameSuffix,'abc');
      const id=first.participantSession.participantSessionId;
      const reentry=await request('POST',routes.participant.signIn,{...input,participantCode:'ABC'});
      assert.equal(reentry.participantSession.participantSessionId,id);assert.equal(reentry.participantSession.participantCode,'abc');assert.equal(reentry.participantSession.originalNameSuffix,'abc');
      assert.notEqual(reentry.sessionToken,first.sessionToken);
      await request('GET',resolveRoutePath(routes.participant.getRuntimeState,{participantSessionId:id}),undefined,first.sessionToken,401);
      const saved=await repository.getParticipantSessionById(id);assert.equal(saved.participantCode,'abc');assert.equal(saved.originalNameSuffix,'abc');
      const restarted=[];for(let i=0;i<2;i++)restarted.push(await request('POST',routes.participant.signIn,{...input,loginKey:'http-native-restart'}));
      assert.notEqual(restarted[0].participantSession.participantSessionId,restarted[1].participantSession.participantSessionId);
      assert.notEqual(restarted[0].participantSession.originalNameSuffix,restarted[1].participantSession.originalNameSuffix);
      for(const entry of restarted)assert.match(entry.participantSession.originalNameSuffix,/^abc\/[a-z0-9_-]{8}$/);
    });
    await t.test('protected HTTP keeps binary native Login peers, credentials and private answers isolated',async()=>{
      const names=['http-binary-login','HTTP-binary-login','http-Ä-login','http-ä-login','http-é-login','http-e\u0301-login'];
      const password=index=>'Owned-HTTP-binary-'+index+'-secret';
      const document=`<Testtakers xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/testcenter-testtaker-xml/18.0"><Metadata/><Group id="HTTP.BINARY.LOGINS" label="Owned HTTP binary logins">${names.map((name,index)=>`<Login name="${name}" pw="${password(index)}" mode="run-hot-return"><Booklet codes="Shared">${bookletKey}</Booklet></Login>`).join('')}</Group></Testtakers>`;
      await request('POST',workspace+'/participant-roster',{rosterText:document},operator,201);
      const signIn=(index,code='Shared')=>request('POST',routes.participant.signIn,{tenantKey,workspaceKey,loginKey:names[index],password:password(index),participantCode:code});
      const identities=await Promise.all(names.map((_,index)=>signIn(index)));
      assert.equal(new Set(identities.map(identity=>identity.participantSession.participantSessionId)).size,names.length);
      const currentPath=identity=>resolveRoutePath(routes.participant.getCurrentRunState,{participantSessionId:identity.participantSession.participantSessionId});
      const tests=[],answers=names.map(name=>'Private native answer '+name);
      for(let index=0;index<names.length;index++){
        assert.equal(identities[index].participantSession.originalLoginKey,names[index]);
        const run=(await resume(identities[index])).testRun;tests.push(run);
        await request('POST',resolveRoutePath(routes.participant.saveProgress,{testRunId:run.testRunId}),{
          deliveryId:randomUUID(),status:'running',responseOnly:true,responseUnitKey:run.currentUnitKey,unitResponse:answers[index],responseTimestamp:Date.now()
        },identities[index].sessionToken);
      }
      assert.equal(new Set(tests.map(run=>run.testRunId)).size,names.length);
      for(let owner=0;owner<names.length;owner++){
        const state=(await request('GET',currentPath(identities[owner]),undefined,identities[owner].sessionToken)).currentRunState;
        assert.equal(state.testRun.testRunId,tests[owner].testRunId);assert.equal(state.testRun.unitResponses[tests[owner].currentUnitKey],answers[owner]);
        for(let peer=0;peer<names.length;peer++)if(peer!==owner)await request('GET',currentPath(identities[owner]),undefined,identities[peer].sessionToken,401);
      }
      const renewed=await signIn(0,'sHaReD');assert.equal(renewed.participantSession.participantSessionId,identities[0].participantSession.participantSessionId);
      await request('GET',currentPath(identities[0]),undefined,identities[0].sessionToken,401);
      for(let index=0;index<names.length;index++){
        const active=index===0?renewed:identities[index];
        const state=(await request('GET',currentPath(active),undefined,active.sessionToken)).currentRunState;
        assert.equal(state.testRun.testRunId,tests[index].testRunId);assert.equal(state.testRun.unitResponses[tests[index].currentUnitKey],answers[index]);
      }
    });
    await t.test('existing protected native bearers observe imported mode and review permissions without reauthentication',async()=>{
      const names=['http-live-mode','HTTP-live-mode'];
      const document=(mode,peer=false)=>`<Testtakers xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/testcenter-testtaker-xml/18.0"><Metadata/><Group id="HTTP.LIVE.MODE" label="Owned live mode"><Login name="${names[0]}" pw="Owned-live-mode-secret" mode="${mode}"><Booklet codes="AbC">${bookletKey}</Booklet></Login>${peer?`<Login name="${names[1]}" pw="Owned-live-mode-secret" mode="run-hot-return"><Booklet codes="AbC">${bookletKey}</Booklet></Login>`:''}</Group></Testtakers>`;
      const upload=(mode,peer=false)=>request('POST',workspace+'/participant-roster',{rosterText:document(mode,peer)},operator,201);
      await upload('run-hot-return',true);
      const identities=await Promise.all(names.map(loginKey=>request('POST',routes.participant.signIn,{tenantKey,workspaceKey,loginKey,password:'Owned-live-mode-secret',participantCode:'abc'})));
      const runs=[];
      for(let index=0;index<identities.length;index++){
        const run=(await resume(identities[index])).testRun;runs.push(run);
        await request('POST',resolveRoutePath(routes.participant.saveProgress,{testRunId:run.testRunId}),{
          deliveryId:randomUUID(),status:'running',responseOnly:true,responseUnitKey:run.currentUnitKey,unitResponse:'Retained native live-mode answer '+index,responseTimestamp:Date.now()
        },identities[index].sessionToken);
      }
      const currentPath=index=>resolveRoutePath(routes.participant.getCurrentRunState,{participantSessionId:identities[index].participantSession.participantSessionId});
      const before=await Promise.all(identities.map(async(identity,index)=>(await request('GET',currentPath(index),undefined,identity.sessionToken)).currentRunState));
      const reviewPath=resolveRoutePath(routes.participant.listReviews,{testRunId:runs[0].testRunId});
      await request('GET',reviewPath,undefined,identities[0].sessionToken,403);
      for(const mode of ['run-review','run-hot-return']){
        await upload(mode);
        const changed=(await request('GET',currentPath(0),undefined,identities[0].sessionToken)).currentRunState;
        assert.equal(changed.participantSession.executionMode,mode);assert.equal(changed.testRun.executionMode,mode);
        assert.deepEqual({...changed.testRun,executionMode:before[0].testRun.executionMode},before[0].testRun);
        assert.deepEqual({...changed.participantSession,executionMode:before[0].participantSession.executionMode},before[0].participantSession);
        await request('GET',reviewPath,undefined,identities[0].sessionToken,mode==='run-review'?200:403);
        const peer=(await request('GET',currentPath(1),undefined,identities[1].sessionToken)).currentRunState;
        assert.deepEqual(peer.testRun,before[1].testRun);assert.deepEqual(peer.participantSession,before[1].participantSession);
      }
    });
    await t.test('protected XML roster HTTP retains exact labels and empty-label login failure without inventing a snapshot',async()=>{
      const scope=await repository.getWorkspaceByScope(tenantKey,workspaceKey);
      const cases=JSON.parse(await readFile(new URL('./fixtures/original-group-label-cases.json',import.meta.url),'utf8'));
      for(const row of cases){
        const loginKey='http-label-'+row.id.toLowerCase(),groupKey='HTTP.LABEL.'+row.id;
        const document=attribute=>`<Testtakers xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/testcenter-testtaker-xml/18.0"><Metadata/><Group id="${groupKey}" label="${attribute}"><Login name="${loginKey}" pw="Owned-http-label-secret" mode="run-hot-return"><Booklet>${bookletKey}</Booklet></Login></Group></Testtakers>`;
        const upload=attribute=>request('POST',workspace+'/participant-roster',{rosterText:document(attribute)},operator,201);
        await upload(row.attribute);
        const roster=(await repository.listParticipantRosterEntriesByWorkspace(scope.tenantId,scope.workspaceId)).find(entry=>entry.loginKey===loginKey);
        assert.equal(roster.groupLabel,row.expected);
        const input={tenantKey,workspaceKey,loginKey,password:'Owned-http-label-secret',groupLabel:'Forged',createdAt:'2099-01-01T00:00:00Z'};
        if(row.id==='EMPTY'){
          const before=await repository.listOriginalParticipantGroupsByWorkspace(scope.tenantId,scope.workspaceId);
          for(const password of ['Owned-http-label-secret','wrong']){
            const failed=await request('POST',routes.participant.signIn,{...input,password},undefined,500);
            assert.equal(failed.error,'original_group_label_invalid');
          }
          assert.deepEqual(await repository.listOriginalParticipantGroupsByWorkspace(scope.tenantId,scope.workspaceId),before);
          assert.ok(!(await repository.listParticipantSessionsByWorkspace(scope.tenantId,scope.workspaceId)).some(session=>session.loginKey===loginKey));
          await upload('  Recovered empty Ω  ');
        }
        await request('POST',routes.participant.signIn,input);
        const group=(await repository.listOriginalParticipantGroupsByWorkspace(scope.tenantId,scope.workspaceId)).find(group=>group.groupKey===groupKey);
        assert.equal(group.groupLabel,row.id==='EMPTY'?'  Recovered empty Ω  ':row.expected);
        assert.notEqual(group.createdAt,input.createdAt);
      }
    });
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

    await t.test('protected API keeps Original Test time separate from Unit answers and logs, ignores forged evidence and persists explicit same-unit state writes',async()=>{
      const identity=await login('result-clock'),entered=(await resume(identity)).testRun;
      const path=resolveRoutePath(routes.participant.saveProgress,{testRunId:entered.testRunId});
      const original=structuredClone(entered.originalResultState);
      assert.equal(original.hasTestState,true);assert.ok(original.lastOpenedAt);assert.ok(original.lastTestStateAt);
      const before=(await snapshot(identity)).runs[0];
      const body={deliveryId:randomUUID(),status:'running',responseOnly:true,responseUnitKey:entered.currentUnitKey,
        unitResponse:'Owned exact answer Ä/β',responseTimestamp:Date.now(),
        originalResultState:{lastOpenedAt:'2099-01-01T00:00:00.000Z',lastTestStateAt:'2099-01-01T00:00:00.000Z',lastTestModifiedAt:'2099-01-01T00:00:00.000Z',hasTestState:false}};
      await request('POST',path,body,undefined,401);assert.deepEqual((await snapshot(identity)).runs[0],before);
      const saved=(await request('POST',path,body,identity.sessionToken)).testRun,savedStored=(await snapshot(identity)).runs[0];
      assert.deepEqual(JSON.parse(JSON.stringify(savedStored)),saved);
      assert.equal(saved.unitResponses[entered.currentUnitKey],body.unitResponse);assert.deepEqual(saved.originalResultState,original);
      await request('POST',path,body,identity.sessionToken);assert.deepEqual((await snapshot(identity)).runs[0],savedStored);
      await request('POST',resolveRoutePath(routes.participant.saveTestLogs,{testRunId:entered.testRunId}),{
        deliveryId:randomUUID(),logs:[{entries:[{key:'CURRENT_UNIT_ID',content:entered.currentUnitKey,timeStamp:Date.now()}]}]},identity.sessionToken);
      assert.deepEqual((await snapshot(identity)).runs[0],savedStored);
      const stateWritten=(await request('POST',path,{currentUnitKey:entered.currentUnitKey,status:'running'},identity.sessionToken)).testRun;
      const stateWrittenStored=(await snapshot(identity)).runs[0];
      assert.equal(stateWritten.originalResultState.lastOpenedAt,original.lastOpenedAt);
      assert.ok(Date.parse(stateWritten.originalResultState.lastTestStateAt)>Date.parse(original.lastTestStateAt));
      assert.equal(stateWritten.originalResultState.lastTestModifiedAt,stateWritten.originalResultState.lastTestStateAt);
      assert.deepEqual(stateWritten.unitResponses,saved.unitResponses);
      await request('POST',path,{currentUnitKey:'nonexistent-owned-unit',status:'running'},identity.sessionToken,404);
      assert.deepEqual((await snapshot(identity)).runs[0],stateWrittenStored);
      const reopened=(await resume(identity)).testRun;
      assert.ok(Date.parse(reopened.originalResultState.lastOpenedAt)>Date.parse(original.lastOpenedAt));
      assert.equal(reopened.originalResultState.lastTestStateAt,stateWritten.originalResultState.lastTestStateAt);
      assert.equal(reopened.originalResultState.lastTestModifiedAt,reopened.originalResultState.lastOpenedAt);
      assert.deepEqual(reopened.unitResponses,saved.unitResponses);
    });
    await t.test('non-saving authenticated review opens a Test without creating saved Test state or answers',async()=>{
      const identity=await login('result-review'),entered=(await resume(identity)).testRun;
      assert.equal(entered.originalResultState.hasTestState,false);assert.equal(entered.originalResultState.lastTestStateAt,null);
      assert.ok(entered.originalResultState.lastOpenedAt);
      const saved=(await request('POST',resolveRoutePath(routes.participant.saveProgress,{testRunId:entered.testRunId}),{
        currentUnitKey:entered.currentUnitKey,status:'running',unitResponse:'Must remain transient',originalResultState:{hasTestState:true}},identity.sessionToken)).testRun;
      assert.deepEqual(saved.originalResultState,entered.originalResultState);assert.deepEqual(saved.unitResponses,{});
      const state=await snapshot(identity);assert.deepEqual(state.runs[0].originalResultState,entered.originalResultState);assert.deepEqual(state.logs,[]);
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
        await resume(identity);const reopened=await snapshot(identity);
        assert.ok(Date.parse(reopened.runs[0].originalResultState.lastOpenedAt)>Date.parse(state.runs[0].originalResultState.lastOpenedAt));
        assert.deepEqual(reopened,{...state,runs:[{...state.runs[0],stateRevision:state.runs[0].stateRevision+1,
          originalResultState:{...state.runs[0].originalResultState,lastOpenedAt:reopened.runs[0].originalResultState.lastOpenedAt,lastTestModifiedAt:reopened.runs[0].originalResultState.lastOpenedAt}}]});
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
