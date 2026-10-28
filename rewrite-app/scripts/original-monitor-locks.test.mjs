import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {Pool,types as pgTypes} from 'pg';
import {createFirstSliceServices,decodeOriginalTestLogJson,formatOriginalTestLogEntry} from '@testcenter-rewrite-app/application';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceStorage} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
import {createProductionApiServer} from '../apps/api/dist/apps/api/src/index.js';
import {prepareOriginalXmlSchemaValidator} from '../packages/application/dist/packages/application/src/original-xml-schema.js';
const source=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-monitor-locks/',import.meta.url),receipt=JSON.parse(await readFile(new URL('receipt.json',source),'utf8'));
const validator=await prepareOriginalXmlSchemaValidator(resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE||'.data/original-xml-schemas'),process.env.FIRST_SLICE_XML_SCHEMA_DOWNLOAD!=='false');
const password='Owned selected lock password',one='owned-lock-one',two='owned-lock-two',peer='owned-lock-peer',monitorName='owned-lock-monitor',studyName='owned-lock-study',group='ORACLE.LOCK',otherGroup='ORACLE.LOCK.PEER';
const xml=(type,body)=>`<${type} xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/${type==='Unit'?'unit-xml/17.6':type==='Booklet'?'testcenter-booklet-xml/18.0':'testcenter-testtaker-xml/18.0'}">${body}</${type}>`;
const loginXml=(name,mode,book=true)=>`<Login name="${name}" pw="${password}" mode="${mode}">${book?'<Booklet codes="Shared">ORACLE.POW.BOOK</Booklet>':''}</Login>`;
const roster=(moved=false,mode='run-hot-return')=>xml('Testtakers','<Metadata/>'+`<Group id="${group}" label="Owned lock">`+loginXml(monitorName,'monitor-group',false)+loginXml(studyName,'monitor-study',false)+(moved?'':loginXml(one,mode))+loginXml(two,'run-trial')+'</Group>'+`<Group id="${otherGroup}" label="Owned peer">`+loginXml(peer,'run-hot-return')+(moved?loginXml(one,mode):'')+'</Group>');
const denied=status=>error=>error.statusCode===status;
test('Source109 hash-bound protected evidence retains Source91 and all strict selected lock inputs',async()=>{
 const m=JSON.parse(await readFile(new URL('manifest.json',source),'utf8'));assert.equal(m.checks,109);assert.equal(m.precedingChecksRetained,91);assert.equal(receipt.success,true);assert.equal(receipt.testMode,false);
 for(const[name,sha]of Object.entries(m.files))assert.equal(createHash('sha256').update(await readFile(new URL(name,source))).digest('hex'),sha);
 const old=JSON.parse(await readFile(new URL('../native-monitor-frontend-support/receipt.json',source),'utf8'));assert.deepEqual(receipt.checks.slice(0,91).map(row=>row.name),old.checks.map(row=>row.name));
 assert.equal(receipt.checks.at(-1).missing,401);assert.equal(receipt.checks.at(-2).status,500);
});
for(const kind of process.env.FIRST_SLICE_STORE==='postgres'?['postgres']:['memory','file','sqlite'])test(`${kind}: selected native monitor lock/unlock preserves literal Source stages and private scope`,async t=>{
 const directory=await mkdtemp(join(tmpdir(),'owned-selected-lock-')),file=join(directory,kind==='file'?'state.json':'state.sqlite'),schema='owned_lock_'+randomUUID().replaceAll('-',''),url=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;url?.searchParams.set('options','-c search_path='+schema);
 let storage,repository,services,pool,server,control,time=Date.parse('2026-10-28T12:00:00Z'),monitor,study,owner,second,foreign,firstId,secondId,foreignId,ids,scope,actor,scopeMap;
 const options=()=>({repository,now:()=>new Date(time).toISOString(),originalXmlSchemaValidator:validator,xmlSchemaProfile:'original-19'});
 const open=async()=>{storage=kind==='memory'?storage??{repository:createInMemoryFirstSliceRepository(),shutdown:async()=>{}}:kind==='file'?await createFileFirstSliceStorage(file):kind==='sqlite'?createSqliteFirstSliceStorage(file):await createPostgresFirstSliceStorage(url.toString());repository=storage.repository;services=createFirstSliceServices(options());};
 const login=async name=>{const access=await services.originalSession.login({name,password});const state=await services.originalAuthentication.read({token:access.token});return state.kind==='login'?services.originalAuthentication.person({loginToken:state.token,code:'Shared'}):state;};
 const change=(testIds,locked=true,token=monitor.token,groupKey=group)=>services.originalMonitor.changeLocks({token,groupKey,locked,body:{testIds}});
 const logs=async()=> (await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId)).filter(row=>row.testRunId===scopeMap.testRunId);
 const run=()=>repository.getTestRunById(scopeMap.testRunId);
 const list=(token=monitor.token,groupKey=group)=>services.originalMonitor.sessions({token,groupKey}).then(JSON.parse);
 try{
  if(url){pool=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await pool.query(`CREATE SCHEMA "${schema}"`);}await open();
  const tenant=await services.platform.createTenant({tenantKey:'owned-'+randomUUID(),displayName:'Owned locks'}),workspace=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'owned',displayName:'Owned locks'});ids={tenantId:tenant.tenantId,workspaceId:workspace.workspaceId};scope={tenantKey:tenant.tenantKey,workspaceKey:workspace.workspaceKey};
  const upload=(fileName,sourceDocument,mediaType='application/xml')=>services.contentIntake.uploadWorkspaceFile({...scope,fileName,sourceDocument,mediaType});
  await upload('player.html','<html><script type="application/ld+json">'+JSON.stringify({id:'owned-lock-player',version:'1.2.3',specVersion:'6.0',metadataVersion:'2.0',type:'player',name:[{lang:'de',value:'Owned Player'}]})+'</script><main>Owned</main></html>','text/html');
  await upload('unit.xml',xml('Unit','<Metadata><Id>ORACLE.POW.UNIT</Id><Label>Owned Unit</Label></Metadata><Definition player="owned-lock-player@1.2.3">Owned</Definition>'));
  await upload('booklet.xml',xml('Booklet','<Metadata><Id>ORACLE.POW.BOOK</Id><Label>Owned Booklet</Label></Metadata><Units><Unit id="ORACLE.POW.UNIT" label="Owned Unit"/></Units>'));
  const importRoster=(moved,mode)=>services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:roster(moved,mode)});await importRoster();
  monitor=await login(monitorName);study=await login(studyName);owner=await login(one);second=await login(two);foreign=await login(peer);
  const packet=(await list()).find(row=>row.personLabel===one+'/Shared');firstId=String(packet.testId);secondId=String((await list()).find(row=>row.personLabel===two+'/Shared').testId);foreignId=String((await list(study.token,otherGroup))[0].testId);
  scopeMap=await repository.findOriginalTestNumber({...owner.participantSession,testNumber:firstId});actor={...monitor.participantSession,originalLoginKey:monitor.participantSession.originalLoginKey,mode:'monitor-group'};
  await t.test('unopened and repeated selected locks retain state identity and append zero-clock numeric actor logs, unlock adds none',async()=>{
   const before=await run(),actorNumber=await repository.getOriginalPersonNumber(monitor.participantSession);time+=5000;await change([Number(firstId)]);let after=await run();assert.equal(after.locked,true);assert.equal(after.originalResultState.lastOpenedAt,null);assert.deepEqual(after.originalTestState,before.originalTestState);assert.deepEqual(after.unitResponses,before.unitResponses);assert.equal(after.controllerEntry,undefined);assert.equal(Math.floor(Date.parse(after.originalResultState.lastTestModifiedAt)/1000),time/1000);assert.ok(after.originalResultState.lastTestModifiedAt>before.originalResultState.lastTestModifiedAt);
   assert.deepEqual((await logs()).map(row=>({timestamp:row.timestamp,logentry:formatOriginalTestLogEntry(row)})),[{timestamp:0,logentry:'locked by monitor : '+actorNumber}]);time+=5000;await change([Number(firstId),Number(firstId)]);assert.equal((await logs()).length,3);assert.equal(Math.floor(Date.parse((await run()).originalResultState.lastTestModifiedAt)/1000),time/1000);
   const oldLogs=await logs();time+=5000;await change([Number(firstId)],false);assert.equal((await run()).locked,false);assert.equal((await list()).find(row=>String(row.testId)===firstId).testState.status,'pending');assert.deepEqual(await logs(),oldLogs);
  });
  await t.test('strict selected item types and foreach object values match all Source109 input vectors in their original sequential order',async()=>{
   const vectors=[['missing',{}],['nullField',{testIds:null}],['boolField',{testIds:false}],['stringField',{testIds:'x'}],['objectField',{testIds:{a:Number(firstId)}}],['stringId',{testIds:[firstId]}],['floatId',{testIds:[Number(firstId)+.5]}],['nullId',{testIds:[null]}],['boolId',{testIds:[true]}],['objectId',{testIds:[{}]}],['negative',{testIds:[-1]}],['unknown',{testIds:[9223372036854775000]}],['repeated',{testIds:[Number(firstId),Number(firstId)]}],['mixed',{testIds:[Number(firstId),firstId]}]];
   for(const[label,body]of vectors){await change([Number(firstId)],false);const expected=receipt.checks.find(row=>row.name==='selected Monitor lock input '+label);let status=200;try{await services.originalMonitor.changeLocks({token:monitor.token,groupKey:group,locked:true,body:decodeOriginalTestLogJson(JSON.stringify(body))});}catch(error){status=error.statusCode;}assert.equal(status,expected.status,label);assert.equal((await run()).locked,expected.locked,label);}
   await assert.rejects(services.originalMonitor.changeLocks({token:monitor.token,groupKey:group,locked:true,body:decodeOriginalTestLogJson('{"testIds":['+firstId+'.0]}')}),denied(500));
   await assert.rejects(change([Number(firstId)],true,monitor.token,group.toLowerCase()),denied(400));
  });
  await t.test('group mismatch and late item errors preserve earlier successful lock or unlock, while foreign route is denied before any mutation',async()=>{
   await change([Number(firstId)],false);await assert.rejects(change([Number(firstId),Number(foreignId)]),denied(400));assert.equal((await run()).locked,true);
   await assert.rejects(change([Number(firstId),firstId],false),denied(500));assert.equal((await run()).locked,false);
   const before=await repository.getTestRunById((await repository.findOriginalTestNumber({...foreign.participantSession,testNumber:foreignId})).testRunId);
   await assert.rejects(change([Number(foreignId)],true,monitor.token,otherGroup),denied(403));assert.deepEqual(await repository.getTestRunById(before.testRunId),before);
   await change([Number(foreignId)],true,study.token,otherGroup);await change([Number(foreignId)],false,study.token,otherGroup);
   await assert.rejects(change([],true,owner.token),denied(403));
  });
  await t.test('opened saved Test and Unit data survive locks; unlock restores running and can target review mode outside monitor list',async()=>{
   await services.originalTest.read({token:owner.token,testNumber:firstId});await services.originalTest.patchState({token:owner.token,testNumber:firstId,patch:[{key:'CURRENT_UNIT_ID',content:'ORACLE.POW.UNIT',timeStamp:111}]});await services.originalUnit.patchState({token:owner.token,testNumber:firstId,unitName:'ORACLE.POW.UNIT',body:{newState:[{key:'PRESENTATION_PROGRESS',content:'some',timeStamp:112}]}});
   await services.originalUnit.putResponse({token:owner.token,testNumber:firstId,unitName:'ORACLE.POW.UNIT',body:{timeStamp:113,dataParts:{private:'owned answer'},responseType:'owned'}});const before=await run(),unitBefore=await repository.getOriginalUnit({...scopeMap,unitName:'ORACLE.POW.UNIT'});
   await change([Number(firstId)]);await change([Number(firstId)],false);const after=await run();assert.equal(after.originalResultState.lastOpenedAt,before.originalResultState.lastOpenedAt);assert.deepEqual(after.originalTestState,before.originalTestState);assert.deepEqual(after.unitResponses,before.unitResponses);assert.deepEqual(await repository.getOriginalUnit({...scopeMap,unitName:'ORACLE.POW.UNIT'}),unitBefore);assert.equal((await list()).find(row=>String(row.testId)===firstId).testState.status,'running');
   await importRoster(false,'run-review');assert.equal((await list()).some(row=>String(row.testId)===firstId),false);await change([Number(firstId)]);assert.equal((await run()).locked,true);await importRoster();
  });
  await t.test('native monitor own Tests have real operational membership and cannot bypass workspace boundaries',async()=>{
   const ownId=await services.originalTest.create({token:monitor.token,bookletName:'ORACLE.POW.BOOK'});await change([Number(ownId)]);await change([Number(ownId)],false);
   const ownPerson=(await services.originalAuthentication.read({token:monitor.token})).participantSession,ownMap=await repository.findOriginalTestNumber({...ownPerson,testNumber:ownId});assert.equal((await repository.getTestRunById(ownMap.testRunId)).locked,false);
   const otherWorkspace=await services.platform.createWorkspace({tenantKey:scope.tenantKey,workspaceKey:'foreign',displayName:'Owned foreign'}),foreignScope={tenantKey:scope.tenantKey,workspaceKey:otherWorkspace.workspaceKey};
   const sources=await repository.listSourcePackagesByWorkspace(ids.tenantId,ids.workspaceId);
   for(const name of ['player.html','unit.xml','booklet.xml']){const file=sources.find(row=>row.fileName.endsWith(name));assert.ok(file);await services.contentIntake.uploadWorkspaceFile({...foreignScope,fileName:name,sourceDocument:file.sourceDocument,mediaType:file.mediaType});}
   const name='owned-lock-foreign-workspace',foreignGroup='ORACLE.LOCK.FOREIGN';await services.workspaceAdminRead.importParticipantRoster({...foreignScope,rosterText:xml('Testtakers','<Metadata/>'+`<Group id="${foreignGroup}" label="Owned foreign">`+loginXml(name,'run-hot-return')+'</Group>')});
   const person=await login(name),testNumber=await services.originalTest.create({token:person.token,bookletName:'ORACLE.POW.BOOK'}),mapping=await repository.findOriginalTestNumber({...person.participantSession,testNumber}),before=await repository.getTestRunById(mapping.testRunId);
   await assert.rejects(change([Number(testNumber)],true,monitor.token,foreignGroup),denied(403));await assert.rejects(change([Number(testNumber)],true,study.token,foreignGroup),denied(404));await assert.rejects(repository.changeOriginalMonitorTestLock(actor,group,testNumber,true,new Date(time).toISOString()),denied(404));assert.deepEqual(await repository.getTestRunById(mapping.testRunId),before);
  });
  await t.test('current membership is checked inside store writes rather than a stale person or prior session snapshot',async()=>{
   await importRoster(true);await assert.rejects(repository.changeOriginalMonitorTestLock(actor,group,firstId,false,new Date(time).toISOString()),denied(400));
   await change([Number(firstId)],false,study.token,otherGroup);await importRoster();
   const candidates=await repository.listOperationalLoginMigrationCandidatesByWorkspace(ids.tenantId,ids.workspaceId),privateRows=await repository.listOriginalOperationalLoginsByWorkspace(ids.tenantId,ids.workspaceId);
   await repository.replaceOperationalLoginMigrationCandidatesByWorkspace(ids.tenantId,ids.workspaceId,candidates,privateRows.filter(row=>row.loginKey!==monitorName));
   await assert.rejects(repository.changeOriginalMonitorTestLock(actor,group,firstId,true,new Date(time).toISOString()),denied(403));await importRoster();monitor=await login(monitorName);
  });
  await t.test('a log failure follows the committed lock and stops later recipients without undoing earlier stages',async()=>{
   await change([Number(firstId),Number(secondId)],false);const count=(await logs()).length;
   const failRepository=new Proxy(repository,{get(target,key){if(key==='appendOriginalTestLogs')return async()=>{throw Error('Owned log write failure');};return Reflect.get(target,key);}});
   const failed=createFirstSliceServices({...options(),repository:failRepository});await assert.rejects(failed.originalMonitor.changeLocks({token:monitor.token,groupKey:group,locked:true,body:{testIds:[Number(firstId),Number(secondId)]}}),/Owned log write failure/);
   assert.equal((await run()).locked,true);assert.equal((await logs()).length,count);assert.equal((await repository.getTestRunById((await repository.findOriginalTestNumber({...second.participantSession,testNumber:secondId})).testRunId)).locked,false);
  });
  if(kind==='sqlite'||kind==='postgres')await t.test('native writes never decode saved state, answers or Unit payloads and preserve lossless signed-int64 Test identities',async()=>{
   control=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()});const query=async(sql,args=[])=>kind==='sqlite'?control.prepare(sql).all(...args):(await control.query(sql,args)).rows;
   const before=await run(),marker='owned-private-response-'+randomUUID();await query(kind==='sqlite'?'UPDATE test_runs SET unit_responses_json=?,original_test_state_json=? WHERE test_run_id=?':'UPDATE test_runs SET unit_responses_json=$1::jsonb,original_test_state_json=$2::jsonb WHERE test_run_id=$3',[JSON.stringify({private:marker}),JSON.stringify({private:marker}),scopeMap.testRunId]);
   const parse=JSON.parse,pgParse=pgTypes.getTypeParser(3802,'text'),guarded=original=>text=>{if(typeof text==='string'&&text.includes(marker))throw Error('Private lock payload decoded');return original(text);};
   try{JSON.parse=guarded(parse);if(kind==='postgres')pgTypes.setTypeParser(3802,'text',guarded(pgParse));await assert.rejects(run(),/Private lock payload decoded/);await change([Number(firstId)]);await change([Number(firstId)],false);}finally{JSON.parse=parse;pgTypes.setTypeParser(3802,'text',pgParse);}
   const persisted=await query(kind==='sqlite'?'SELECT unit_responses_json,original_test_state_json FROM test_runs WHERE test_run_id=?':'SELECT unit_responses_json,original_test_state_json FROM test_runs WHERE test_run_id=$1',[scopeMap.testRunId]);assert.ok(JSON.stringify(persisted).includes(marker));
   await query(kind==='sqlite'?'UPDATE test_runs SET unit_responses_json=?,original_test_state_json=? WHERE test_run_id=?':'UPDATE test_runs SET unit_responses_json=$1::jsonb,original_test_state_json=$2::jsonb WHERE test_run_id=$3',[JSON.stringify(before.unitResponses),JSON.stringify(before.originalTestState),scopeMap.testRunId]);
   const huge='9223372036854775806';await query(kind==='sqlite'?'UPDATE original_test_numbers SET test_number=? WHERE test_run_id=?':'UPDATE original_test_numbers SET test_number=$1 WHERE test_run_id=$2',[huge,scopeMap.testRunId]);
   try{await services.originalMonitor.changeLocks({token:monitor.token,groupKey:group,locked:true,body:decodeOriginalTestLogJson('{"testIds":['+huge+']}')});assert.equal((await run()).locked,true);await services.originalMonitor.changeLocks({token:monitor.token,groupKey:group,locked:false,body:decodeOriginalTestLogJson('{"testIds":['+huge+']}')});assert.equal((await run()).locked,false);}finally{await query(kind==='sqlite'?'UPDATE original_test_numbers SET test_number=? WHERE test_run_id=?':'UPDATE original_test_numbers SET test_number=$1 WHERE test_run_id=$2',[firstId,scopeMap.testRunId]);}
   if(kind==='sqlite')control.close();else await control.end();control=undefined;
  });
  await t.test('store restart retains locks, raw logs, native identities and current monitor bearer',async()=>{
   await change([Number(firstId)]);const before=await run(),beforeLogs=await logs();if(kind!=='memory'){await storage.shutdown();await open();}assert.deepEqual(await run(),before);assert.deepEqual(await logs(),beforeLogs);await change([Number(firstId)],false);
  });
  if(kind==='sqlite'||kind==='postgres')await t.test('real protected HTTP uses literal empty success, strict raw types and authorization before path/body decoding',async()=>{
   const env={FIRST_SLICE_STORE:kind,FIRST_SLICE_SQLITE_FILE:file,FIRST_SLICE_BOOTSTRAP_DEMO:'false',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_XML_SCHEMA_PROFILE:'original-19',REQUIRE_LOGIN_PASSWORD:'false',FIRST_SLICE_PROOF_OF_WORK_SCOPES:'participant,second_code',FIRST_SLICE_PROOF_OF_WORK_SECRET:'owned-lock-http-challenge-secret-not-production',FIRST_SLICE_PROOF_OF_WORK_PREVIOUS_SECRET:'',FIRST_SLICE_PROOF_OF_WORK_MAX_NUMBER:'12',...(url?{FIRST_SLICE_POSTGRES_URL:url.toString()}:{})};const previous=new Map(Object.keys(env).map(key=>[key,process.env[key]]));try{Object.assign(process.env,env);server=await createProductionApiServer();}finally{for(const[key,value]of previous)if(value===undefined)delete process.env[key];else process.env[key]=value;}
   await new Promise(done=>server.listen(0,'127.0.0.1',done));const base='http://127.0.0.1:'+server.address().port,path='/monitor/group/'+group+'/tests/lock';
   const request=async(method,path,token,body,status=200)=>{const r=await fetch(base+path,{method,headers:{...(token?{AuthToken:token}:{}),...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body}),signal:AbortSignal.timeout(15000)}),text=await r.text();assert.equal(r.status,status,method+' '+path+': '+text);assert.equal(r.headers.get('cache-control'),'private, no-store');return{r,text};};
   const challenge=JSON.parse((await request('POST','/session/challenge',undefined,JSON.stringify({loginType:'login',name:monitorName,password}))).text);let solution;for(let n=0;n<=challenge.maxNumber;n++)if(createHash('sha256').update(challenge.salt+n).digest('hex')===challenge.challenge){solution={algorithm:challenge.algorithm,salt:challenge.salt,challenge:challenge.challenge,signature:challenge.signature,number:n};break;}assert.ok(solution);monitor=JSON.parse((await request('PUT','/session',undefined,JSON.stringify(solution))).text);
   await request('POST',path,undefined,'{',401);await request('POST',path,owner.token,'{',403);await request('POST',path,monitor.token,'{',500);
   await request('POST','/monitor/group/%ZZ/tests/lock',undefined,'{',401);await request('POST','/monitor/group/%ZZ/tests/lock',owner.token,'{',403);await request('POST','/monitor/group/%ZZ/tests/lock',monitor.token,'{',400);
   await request('POST','/monitor/group/'+otherGroup+'/tests/lock',monitor.token,'{',403);
   const good=await request('POST',path,monitor.token,'{"testIds":['+firstId+']}');assert.equal(good.text,'');assert.equal(good.r.headers.get('content-type'),'text/html; charset=UTF-8');
   const bad=await request('POST',path,monitor.token,'{"testIds":['+firstId+'.0]}',500);assert.equal(bad.text,'Internal error.');assert.equal(bad.r.headers.get('test-mode'),'NO');assert.ok(bad.r.headers.get('error-id'));
   assert.equal((await request('POST',path,monitor.token,'')).text,'');assert.equal((await request('POST',path.replace(/lock$/,'unlock'),monitor.token,'{"testIds":['+firstId+']}')).text,'');
   const wrongMethod=await request('GET',path,monitor.token,undefined,405);assert.equal(wrongMethod.r.headers.get('allow'),'POST');
   await new Promise((done,reject)=>server.close(error=>error?reject(error):done()));server=undefined;
  });
 }finally{if(server)await new Promise(done=>server.close(done));if(control){if(kind==='sqlite')control.close();else await control.end();}await storage?.shutdown();if(pool){await pool.query(`DROP SCHEMA "${schema}" CASCADE`);await pool.end();}await rm(directory,{recursive:true,force:true});}
});
