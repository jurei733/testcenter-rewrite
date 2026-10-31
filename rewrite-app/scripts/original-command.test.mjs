import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {request as nodeRequest} from 'node:http';
import {mkdtemp,rm,readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {Pool} from 'pg';
import {createFirstSliceServices,decodeOriginalTestLogJson,formatOriginalTestLogEntry} from '@testcenter-rewrite-app/application';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceStorage} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
import {createProductionApiServer} from '../apps/api/dist/apps/api/src/index.js';
import {prepareOriginalXmlSchemaValidator} from '../packages/application/dist/packages/application/src/original-xml-schema.js';
const validator=await prepareOriginalXmlSchemaValidator(resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE||'.data/original-xml-schemas'),process.env.FIRST_SLICE_XML_SCHEMA_DOWNLOAD!=='false');
const source=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-test-command/',import.meta.url),edges=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-test-command-boundaries/',import.meta.url);
const initial=await readFile(new URL('command-initial.json',source),'utf8'),peerInitial=await readFile(new URL('command-peer.json',source),'utf8'),polling=JSON.parse(await readFile(new URL('command-polling.json',source),'utf8')),vectors=JSON.parse(await readFile(new URL('command-producer-boundaries.json',edges),'utf8'));
const schemas={Unit:'unit-xml/17.6',Booklet:'testcenter-booklet-xml/18.0',Testtakers:'testcenter-testtaker-xml/18.0'},xml=(type,body)=>`<${type} xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/${schemas[type]}">${body}</${type}>`;
const password='Owned command producer secret',one='owned-native-command-one',two='owned-native-command-two',monitorName='owned-native-command-monitor',clock=1793158800;
const kinds=['memory','file','sqlite'];if(process.env.FIRST_SLICE_STORE==='postgres'){assert.ok(process.env.FIRST_SLICE_POSTGRES_URL);kinds.push('postgres');}
for(const kind of kinds)test(`${kind}: real native command producer, queue and ACK retain Source65/67 packets and reservation stages`,async t=>{
 const dir=await mkdtemp(join(tmpdir(),'owned-native-command-')),file=join(dir,kind==='file'?'state.json':'state.sqlite'),schema='owned_command_'+randomUUID().replaceAll('-',''),url=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;url?.searchParams.set('options','-c search_path='+schema);
 let storage,repository,services,pool,created=false;
 const open=async()=>{storage=kind==='memory'?storage??{repository:createInMemoryFirstSliceRepository(),shutdown:async()=>{}}:kind==='file'?await createFileFirstSliceStorage(file):kind==='sqlite'?createSqliteFirstSliceStorage(file):await createPostgresFirstSliceStorage(url.toString());repository=storage.repository;services=createFirstSliceServices({repository,originalXmlSchemaValidator:validator,xmlSchemaProfile:'original-19'});};
 const close=async()=>{const own=storage;if(kind!=='memory')storage=undefined;await own?.shutdown();};
 try{
  if(url){pool=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await pool.query(`CREATE SCHEMA "${schema}"`);created=true;}
  await open();const tenant=await services.platform.createTenant({tenantKey:'owned-'+randomUUID(),displayName:'Owned commands'}),workspace=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'owned',displayName:'Owned commands'}),scope={tenantKey:tenant.tenantKey,workspaceKey:workspace.workspaceKey},ids={tenantId:tenant.tenantId,workspaceId:workspace.workspaceId};
  const upload=(fileName,sourceDocument,mediaType='application/xml')=>services.contentIntake.uploadWorkspaceFile({...scope,fileName,sourceDocument,mediaType});
  await upload('player.html','<html><script type="application/ld+json">'+JSON.stringify({id:'owned-command-player',version:'1.2.3',specVersion:'6.0',metadataVersion:'2.0',type:'player',name:[{lang:'en',value:'Owned Player'}]})+'</script><main>Owned</main></html>','text/html');
  await upload('unit.xml',xml('Unit','<Metadata><Id>ORACLE.POW.UNIT</Id><Label>Owned Unit</Label></Metadata><Definition player="owned-command-player@1.2.3">Owned definition</Definition>'));
  await upload('booklet.xml',xml('Booklet','<Metadata><Id>ORACLE.POW.BOOK</Id><Label>  Current Booklet Ω\n  </Label></Metadata><Units><Unit id="ORACLE.POW.UNIT" label="Owned Unit"/></Units>'));
  await services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:xml('Testtakers','<Metadata/><Group id="ORACLE.COMMAND" label="Owned native commands">'+[one,two,'owned-command-canonical'].map(name=>`<Login name="${name}" pw="${password}" mode="${name==='owned-command-canonical'?'run-hot-return':'run-review'}"><Booklet codes="Shared">ORACLE.POW.BOOK</Booklet></Login>`).join('')+`<Login name="${monitorName}" pw="${password}" mode="monitor-group"/></Group><Group id="OTHER.COMMAND" label="Other group"><Login name="owned-other-command" pw="${password}" mode="run-review"><Booklet codes="Shared">ORACLE.POW.BOOK</Booklet></Login></Group>`)});
  const authenticate=async name=>{const login=await services.originalAuthentication.login({name,password});return login.kind==='login'?{login,person:await services.originalAuthentication.person({loginToken:login.token,code:'Shared'})}:{person:login};};
  const owner=await authenticate(one),peer=await authenticate(two),foreign=await authenticate('owned-other-command'),monitor=await authenticate(monitorName);
  const create=(suffix,person=owner.person)=>services.originalTest.create({token:person.token,bookletName:'ORACLE.POW.BOOK#'+suffix});
  const id=await create('command:one'),peerId=await create('command:two',peer.person),foreignId=await create('command:foreign',foreign.person);
  const poll=(testNumber=id,body={},token=owner.person.token)=>services.originalCommand.poll({token,testNumber,body:typeof body==='string'?decodeOriginalTestLogJson(body):body});
  const send=(body,token=monitor.person.token)=>services.originalCommand.send({token,body:typeof body==='string'?decodeOriginalTestLogJson(body):body});
  const ack=(commandNumber,testNumber=id,token=owner.person.token)=>services.originalCommand.acknowledge({token,testNumber,commandNumber:String(commandNumber)});
  const current=async(testNumber=id,person=owner.person)=>repository.findOriginalTestNumber({...ids,participantSessionId:person.participantSession.participantSessionId,testNumber});
  const run=async(testNumber=id,person=owner.person)=>repository.getTestRunById((await current(testNumber,person)).testRunId);
  if(kind==='sqlite'||kind==='postgres')await t.test('upgrade from actual previous schema is atomic and never backfills canonical commands into a native queue',async()=>{
   const before=await run();await close();const control=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()}),exec=async sql=>kind==='sqlite'?control.exec(sql):control.query(sql),version=kind==='sqlite'?78:72;
   const exists=async()=>kind==='sqlite'?Boolean(control.prepare("SELECT 1 FROM sqlite_master WHERE name='original_native_commands'").get()):Boolean((await control.query("SELECT 1 FROM information_schema.tables WHERE table_schema=current_schema() AND table_name='original_native_commands'")).rowCount);
   try{await exec(`DROP TABLE IF EXISTS original_person_numbers; DROP TABLE IF EXISTS original_person_number_counter; DROP INDEX IF EXISTS original_person_number_parent_scope; DROP TABLE original_native_commands; DROP TABLE IF EXISTS original_native_command_counter; DELETE FROM schema_migrations WHERE version>=${version}`);
    await exec(kind==='sqlite'?`CREATE TRIGGER owned_native_queue_failure BEFORE INSERT ON schema_migrations WHEN NEW.version=${version} BEGIN SELECT RAISE(ABORT,'owned native queue failure'); END`:`CREATE FUNCTION owned_native_queue_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned native queue failure'; END $$; CREATE TRIGGER owned_native_queue_failure BEFORE INSERT ON schema_migrations FOR EACH ROW WHEN (NEW.version=${version}) EXECUTE FUNCTION owned_native_queue_failure()`);
    await assert.rejects(open(),/owned native queue failure/);assert.equal(await exists(),false);
    await exec(kind==='sqlite'?'DROP TRIGGER owned_native_queue_failure':'DROP TRIGGER owned_native_queue_failure ON schema_migrations; DROP FUNCTION owned_native_queue_failure()');
   }finally{if(kind==='sqlite')control.close();else await control.end();}
   await open();assert.deepEqual(await run(),before);assert.equal(await poll(),'[]');
  });
  await t.test('exact Source65 initial and peer packets share one ID across deduplicated recipients and never open or rewrite a Test',async()=>{
   const before=await run();assert.equal(await poll(),'[]');assert.deepEqual(await run(),before);
   await send({keyword:'owned.command.first',arguments:['Ω/x',0,false,true,null,42,1.5],timestamp:clock+10,testIds:[Number(id),Number(peerId),Number(id)]});
   await send({keyword:'owned.command.second',arguments:['second'],timestamp:clock+20,testIds:[Number(id)]});
   await send({keyword:'owned.command.equal',arguments:['equal timestamp'],timestamp:clock+20,testIds:[Number(id)]});
   assert.equal(await poll(),initial);assert.equal(await poll(peerId,{},peer.person.token),peerInitial);assert.deepEqual(await run(),before);assert.equal((await run()).originalResultState.lastOpenedAt,null);
  });
  await t.test('strict body filtering retains executed lookup rows and excludes every equal-clock command',async()=>{
   assert.deepEqual(JSON.parse(await poll(id,{lastCommandId:1})).map(row=>row.id),[2,3]);assert.equal(await poll(id,{lastCommandId:2}),'[]');assert.equal(await poll(id,{lastCommandId:999999999}),'[]');assert.equal(await poll(id,{lastCommandId:0}),initial);
   const before=await run();await assert.rejects(poll(id,{lastCommandId:'1'}),e=>e.statusCode===500);assert.deepEqual(await run(),before);
  });
  await t.test('ACK is scoped, idempotent, preserves Test state and leaves the other recipient of a shared command untouched',async()=>{
   const before=await run();assert.equal(await ack(1),'OK');assert.equal(await ack(1),'OK, was already marked as executed');assert.equal(await poll(peerId,{},peer.person.token),peerInitial);
   await assert.rejects(ack(999999999),e=>e.statusCode===404);await assert.rejects(ack(2,peerId,peer.person.token),e=>e.statusCode===404);
   assert.deepEqual(JSON.parse(await poll(id,{lastCommandId:1})).map(row=>row.id),[2,3]);assert.equal(await ack('0002','000'+id),'OK');assert.equal(await ack(3),'OK');assert.equal(await poll(),'[]');assert.deepEqual(await run(),before);
  });
  await t.test('actual Source65 LOST polling retains state, appends each raw quoted-key zero-clock event and stays available while locked',async()=>{
   await services.originalTest.patchState({token:owner.person.token,testNumber:id,patch:[{key:'CONNECTION',content:'LOST',timeStamp:777}]});const before=await run();
   await poll();await poll();const after=await run();assert.deepEqual(after.originalTestState,before.originalTestState);assert.deepEqual(after.unitResponses,before.unitResponses);assert.equal(after.originalResultState.lastOpenedAt,null);assert.ok(after.originalResultState.lastTestModifiedAt>=before.originalResultState.lastTestModifiedAt);
   assert.equal((await services.originalTest.read({token:owner.person.token,testNumber:id})).firstStart,true);
   await services.originalTest.patchLock({token:owner.person.token,testNumber:id,body:{timeStamp:clock+50,message:'Owned command locked polling'}});
   await send({keyword:'owned.command.locked',arguments:['still queued'],timestamp:clock+30,testIds:[Number(id)]});const queued=JSON.parse(await poll());assert.equal(queued[0].id,4);assert.equal(await ack(4),'OK');await poll();await assert.rejects(services.originalTest.read({token:owner.person.token,testNumber:id}),e=>e.statusCode===423);
   const loggedRunId=(await current()).testRunId;const logs=(await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId)).filter(log=>log.testRunId===loggedRunId).sort((a,b)=>a.recordedAt.localeCompare(b.recordedAt)).map(log=>({timestamp:log.timestamp,logentry:formatOriginalTestLogEntry(log)}));assert.deepEqual(logs,polling.map(row=>({timestamp:row.timestamp,logentry:row.logentry})));assert.equal((await run()).originalTestState.CONNECTION,'LOST');
  });
  await t.test('WebSocket reads stay read-only and final-connection cleanup retains Source zero-clock log semantics',async()=>{
   const token=owner.person.token,testNumber=id;
   await services.originalTest.patchState({token,testNumber,patch:[{key:'CONNECTION',content:'WEBSOCKET',timeStamp:888}]});
   const before=await run(),logs=await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId);
   assert.equal(await services.originalCommand.pending({token,testNumber}),'[]');assert.deepEqual(await run(),before);
   await services.originalCommand.connectionLost({token,testNumber,stillDisconnected:()=>false});assert.deepEqual(await run(),before);assert.deepEqual(await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId),logs);
   await services.originalCommand.connectionLost({token,testNumber,stillDisconnected:()=>true});const after=await run(),nextLogs=await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId);
   assert.deepEqual(after.originalTestState,before.originalTestState);assert.equal(after.locked,before.locked);assert.equal(after.originalResultState.lastOpenedAt,before.originalResultState.lastOpenedAt);assert.equal(nextLogs.length,logs.length+1);
   const added=nextLogs.find(log=>!logs.some(old=>old.participantTestLogId===log.participantTestLogId));assert.equal(added.logKey,'"CONNECTION"');assert.equal(added.logContent,'LOST');assert.equal(added.timestamp,0);
   await assert.rejects(services.originalCommand.connectionLost({token:peer.person.token,testNumber,stillDisconnected:()=>true}),e=>e.statusCode===403);assert.deepEqual(await run(),after);
   await services.originalTest.patchState({token,testNumber,patch:[{key:'CONNECTION',content:'LOST',timeStamp:889}]});const already=await run(),alreadyLogs=await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId);
   await services.originalCommand.connectionLost({token,testNumber,stillDisconnected:()=>true});assert.deepEqual(await run(),already);assert.deepEqual(await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId),alreadyLogs);
  });
  await t.test('all52 production Source67 producer vectors retain their real allocation gap, packet values and insert-failure atomicity across restart',async()=>{
   const fresh=label=>create('command-edge:'+label);
   const marker=async label=>{const target=await fresh('marker-'+label);await send({keyword:'edge.marker',timestamp:clock+100,testIds:[Number(target)]});const packet=JSON.parse(await poll(target));assert.equal(packet.length,1);return packet[0].id;};
   for(const source of vectors){
    const before=await marker(source.label+'-before'),target=await fresh(source.label);let body=source.body;const start=body.lastIndexOf('"testIds":');
    if(start>=0){const head=body.slice(0,start),tail=body.slice(start);const old=String(source.targetTestId),regex=new RegExp('"0*'+old+'"|(?<![0-9])'+old+'(?=[,.\\]])','g');body=head+tail.replace(regex,value=>value.startsWith('"')?value.replace(old,target):target);}
    let status=201;try{await send(body);}catch(error){if(typeof error.statusCode!=='number')throw error;status=error.statusCode;}assert.equal(status,source.produced.status,source.label+' producer');
    let reply,pollStatus=200;try{reply=JSON.parse(await poll(target));}catch(error){pollStatus=error.statusCode;}assert.equal(pollStatus,source.polled.status,source.label+' poll');
    const after=await marker(source.label+'-after');assert.equal(after-before,source.sequenceDelta,source.label+' allocation');assert.equal(before,source.sequenceBefore,source.label+' independent marker identity');
    if(pollStatus===200)assert.deepEqual(reply,source.polled.value,source.label+' exact packet');
   }
   await close();await open();assert.equal(await poll(peerId,{},peer.person.token),peerInitial);
  });
  await t.test('canonical controller entry with unknown native state cannot block delivery or fabricate polling state and logs',async()=>{
   const canonical=(await authenticate('owned-command-canonical')).person,target=await services.originalTest.create({token:canonical.token,bookletName:'ORACLE.POW.BOOK'});
   const entered=await services.participantRuntime.launch({participantSessionId:canonical.participantSession.participantSessionId,bookletKey:'ORACLE.POW.BOOK'});
   assert.equal(entered.testRunId,(await current(target,canonical)).testRunId);assert.equal(entered.status,'running');assert.equal(entered.controllerEntry.active,true);
   const saved=await services.participantRuntime.saveProgress({testRunId:entered.testRunId,status:'running',currentUnitKey:'ORACLE.POW.UNIT'});assert.equal(saved.originalTestState,undefined);assert.equal(saved.originalResultState.hasTestState,true);
   await send({keyword:'owned.canonical.entry',timestamp:clock+250,testIds:[Number(target)]});const before=await run(target,canonical),logs=await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId);
   const rows=JSON.parse(await poll(target,{},canonical.token));assert.equal(rows.length,1);assert.equal(rows[0].keyword,'owned.canonical.entry');assert.equal(await ack(rows[0].id,target,canonical.token),'OK');assert.equal(await poll(target,{},canonical.token),'[]');
   assert.deepEqual(await run(target,canonical),before);assert.deepEqual(await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId),logs);
  });
  await t.test('monitor, ordinary-person, Login and foreign-group boundaries reject before command fields and never reserve or mutate another scope',async()=>{
   const before=await repository.listOriginalCommands(await current(peerId,peer.person),null);
   for(const token of [owner.person.token,owner.login.token])await assert.rejects(send({keyword:7,timestamp:null},token),e=>e.statusCode===403);
   await assert.rejects(send({keyword:'cross-group',timestamp:clock+200,testIds:[Number(foreignId)]}),e=>e.statusCode===404);
   await assert.rejects(poll(id,{lastCommandId:'bad'},peer.person.token),e=>e.statusCode===403);await assert.rejects(poll(id,{},monitor.person.token),e=>e.statusCode===403);await assert.rejects(ack(1,id,peer.person.token),e=>e.statusCode===403);
   assert.deepEqual(await repository.listOriginalCommands(await current(peerId,peer.person),null),before);
  });
  if(kind==='sqlite'||kind==='postgres')await t.test('actual production HTTP retains native body/query distinction, role-before-decoding and exact empty ACK reason',async()=>{
   const env={FIRST_SLICE_STORE:kind,FIRST_SLICE_SQLITE_FILE:file,FIRST_SLICE_BOOTSTRAP_DEMO:'false',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_XML_SCHEMA_PROFILE:'original-19',FIRST_SLICE_PROOF_OF_WORK_SCOPES:'participant,second_code',FIRST_SLICE_PROOF_OF_WORK_SECRET:'owned-command-http-work-secret-not-production',FIRST_SLICE_PROOF_OF_WORK_MAX_NUMBER:'12',...(url?{FIRST_SLICE_POSTGRES_URL:url.toString()}:{})},previous=new Map(Object.keys(env).map(key=>[key,process.env[key]]));let server;
   try{
    try{Object.assign(process.env,env);server=await createProductionApiServer();}finally{for(const[key,value]of previous)if(value===undefined)delete process.env[key];else process.env[key]=value;}
    await new Promise(done=>server.listen(0,'127.0.0.1',done));const base='http://127.0.0.1:'+server.address().port;
    const request=(method,path,token,body,status=200)=>new Promise((resolve,reject)=>{
     const bytes=body===undefined?null:Buffer.from(body),pending=nodeRequest(base+path,{method,headers:{...(token?{AuthToken:token}:{}),...(bytes?{'content-type':'application/json','content-length':String(bytes.length)}:{})}},response=>{
      const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('error',reject);response.on('end',()=>{try{const buffer=Buffer.concat(chunks),text=buffer.toString('utf8');assert.equal(response.statusCode,status,method+' '+path);assert.equal(response.headers['cache-control'],'private, no-store');resolve({bytes:buffer,text,reason:response.statusMessage,headers:response.headers});}catch(error){reject(error);}});
     });pending.setTimeout(15000,()=>pending.destroy(Error('Owned native command HTTP timed out')));pending.on('error',reject);pending.end(bytes);
    });
    const path='/test/'+id+'/commands';
    await request('GET',path,undefined,'{',401);
    for(const token of[owner.login.token,peer.person.token,monitor.person.token])await request('GET',path,token,'{',403);
    await request('PUT','/monitor/command',undefined,'{',401);for(const token of[owner.person.token,owner.login.token])await request('PUT','/monitor/command',token,'{',403);
    const method=await request('POST',path,undefined,'{',405);assert.equal(method.headers.allow,'GET');
    const before=await run(),packet={keyword:'owned.http.command',arguments:['Ω/x',0,false,true,null,42,1.5],timestamp:clock+300,testIds:[Number(id),Number(peerId),Number(id)]};
    const sent=await request('PUT','/monitor/command',monitor.person.token,JSON.stringify(packet),201);assert.equal(sent.bytes.length,0);assert.equal(sent.headers['content-type'],'text/html; charset=UTF-8');assert.deepEqual(await run(),before);
    const delivered=await request('GET',path,owner.person.token),rows=JSON.parse(delivered.text);assert.equal(rows.length,1);assert.equal(rows[0].keyword,packet.keyword);assert.deepEqual(rows[0].arguments,['Ω/x','0','','1','','42','1.5']);assert.equal(rows[0].timestamp,packet.timestamp);const number=String(rows[0].id);
    assert.equal((await request('GET',path+'?lastCommandId='+number,owner.person.token)).text,delivered.text);
    assert.equal((await request('GET',path,owner.person.token,'{"lastCommandId":'+number+'}')).text,'[]');
    const allLogs=await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId),state=await run();const strict=await request('GET',path,owner.person.token,JSON.stringify({lastCommandId:number}),500);assert.equal(strict.text,'Internal error.');assert.equal(strict.headers['test-mode'],'NO');assert.ok(strict.headers['error-id']);assert.deepEqual(await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId),allLogs);assert.deepEqual(await run(),state);
    const first=await request('PATCH','/test/000'+id+'/command/000'+number+'/executed',owner.person.token,'{');assert.equal(first.bytes.length,0);assert.equal(first.reason,'OK');
    const again=await request('PATCH','/test/'+id+'/command/'+number+'/executed',owner.person.token);assert.equal(again.bytes.length,0);assert.equal(again.reason,'OK, was already marked as executed');
    const peerRows=JSON.parse((await request('GET','/test/'+peerId+'/commands',peer.person.token)).text);assert.ok(peerRows.some(row=>String(row.id)===number));await request('PATCH','/test/'+id+'/command/999999999/executed',owner.person.token,undefined,404);
    const result=await run();assert.deepEqual(result.originalTestState,state.originalTestState);assert.deepEqual(result.unitResponses,state.unitResponses);assert.equal(result.stateRevision,state.stateRevision);
   }finally{if(server)await new Promise((done,reject)=>server.close(error=>error?reject(error):done()));}
  });
  await t.test('a stale final target rejects the complete native batch after reservation without modifying Test evidence',async()=>{
   const a=await create('atomic:scope-a'),b=await create('atomic:scope-b'),sa=await current(a),sb=await current(b),number=await repository.reserveOriginalCommandNumber(),actor=monitor.person.participantSession;
   await assert.rejects(repository.appendOriginalCommand(actor,{id:number,keyword:'owned.atomic.scope',arguments:['preserved'],timestamp:String(clock+300)},[sa,{...sb,contentReleaseId:'foreign-release'}]));
   assert.deepEqual(await repository.listOriginalCommands(sa,null),[]);assert.deepEqual(await repository.listOriginalCommands(sb,null),[]);
   assert.equal(await repository.reserveOriginalCommandNumber(),(BigInt(number)+1n).toString());
  });
  if(kind==='sqlite'||kind==='postgres')await t.test('late SQL failure rolls back every recipient row and preserves the independently reserved command sequence',async()=>{
   const a=await create('atomic:sql-a'),b=await create('atomic:sql-b'),sa=await current(a),sb=await current(b),number=await repository.reserveOriginalCommandNumber(),actor=monitor.person.participantSession;
   const control=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()}),exec=async sql=>kind==='sqlite'?control.exec(sql):control.query(sql);
   try{
    await exec(kind==='sqlite'?`CREATE TRIGGER owned_command_insert_failure BEFORE INSERT ON original_native_commands WHEN NEW.test_number='${b}' BEGIN SELECT RAISE(ABORT,'owned command insert failure'); END`:`CREATE FUNCTION owned_command_insert_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned command insert failure'; END $$; CREATE TRIGGER owned_command_insert_failure BEFORE INSERT ON original_native_commands FOR EACH ROW WHEN (NEW.test_number='${b}') EXECUTE FUNCTION owned_command_insert_failure()`);
    await assert.rejects(repository.appendOriginalCommand(actor,{id:number,keyword:'owned.atomic.sql',arguments:['exact'],timestamp:String(clock+300)},[sa,sb]),/owned command insert failure/);
    assert.deepEqual(await repository.listOriginalCommands(sa,null),[]);assert.deepEqual(await repository.listOriginalCommands(sb,null),[]);
    await exec(kind==='sqlite'?'DROP TRIGGER owned_command_insert_failure':'DROP TRIGGER owned_command_insert_failure ON original_native_commands; DROP FUNCTION owned_command_insert_failure()');
   }finally{if(kind==='sqlite')control.close();else await control.end();}
   await close();await open();assert.deepEqual(await repository.listOriginalCommands(sa,null),[]);assert.deepEqual(await repository.listOriginalCommands(sb,null),[]);assert.equal(await repository.reserveOriginalCommandNumber(),(BigInt(number)+1n).toString());
  });
  if(kind==='file')await t.test('a failed File publication cannot publish native deliveries or refund its already durable number',async()=>{
   const a=await create('atomic:file-a'),b=await create('atomic:file-b'),sa=await current(a),sb=await current(b),number=await repository.reserveOriginalCommandNumber(),actor=monitor.person.participantSession,backup=file+'.owned-backup';
   await rename(file,backup);await mkdir(file);
   try{await assert.rejects(repository.appendOriginalCommand(actor,{id:number,keyword:'owned.atomic.file',arguments:['exact'],timestamp:String(clock+300)},[sa,sb]));}
   finally{await rm(file,{recursive:true});await rename(backup,file);}
   await close();await open();assert.deepEqual(await repository.listOriginalCommands(sa,null),[]);assert.deepEqual(await repository.listOriginalCommands(sb,null),[]);assert.equal(await repository.reserveOriginalCommandNumber(),(BigInt(number)+1n).toString());
  });
  if(kind!=='memory')await t.test('native packet and ACK retain exact numeric command IDs beyond JS safe integers in real durable stores',async()=>{
   if(kind==='file'){
    await close();const state=JSON.parse(await readFile(file,'utf8'));state.originalNativeCommandCounter='9007199254740991';await writeFile(file,JSON.stringify(state));await open();
   }else if(kind==='sqlite'){
    const control=new DatabaseSync(file);try{control.prepare('UPDATE original_native_command_counter SET last_number=? WHERE singleton=1').run('9007199254740991');}finally{control.close();}
   }else{
    const control=new Pool({connectionString:url.toString()});try{await control.query("SELECT setval(pg_get_serial_sequence('original_native_commands','command_number'),'9007199254740991'::bigint,true)");}finally{await control.end();}
   }
   const target=await create('wide:command');await send({keyword:'wide-first',timestamp:clock+400,testIds:[Number(target)]});await send({keyword:'wide-second',timestamp:clock+401,testIds:[Number(target)]});
   const wire=await poll(target);assert.match(wire,/"id":9007199254740992,/);assert.match(wire,/"id":9007199254740993,/);assert.equal(wire.includes('"9007199254740993"'),false);
   const after=await poll(target,'{"lastCommandId":9007199254740992}');assert.match(after,/^\[\{"id":9007199254740993,/);assert.equal(await ack('9007199254740993',target),'OK');assert.equal(await ack('9007199254740993',target),'OK, was already marked as executed');
   await close();await open();assert.equal(await poll(target,'{"lastCommandId":9007199254740992}'),'[]');
  });
  await t.test('deleting only the commander retains recipient commands and clears its private creator reference',async()=>{
   const group='ORACLE.RETIRED.COMMANDER',now=new Date().toISOString();await repository.getOrCreateOriginalParticipantGroup({...ids,groupKey:group,groupLabel:'Retired commander',createdAt:now});
   await repository.bindOriginalLoginGroup({...ids,loginKey:monitorName,groupKey:group,groupSnapshotKey:group,authenticatedAt:now});
   const recipient=await current(peerId,peer.person),before=await repository.listOriginalCommands(recipient,null),deleted=await repository.deleteOriginalGroupResults({...ids,groups:[group]});assert.equal(deleted.deletedPersonCount,1);assert.deepEqual(await repository.listOriginalCommands(recipient,null),before);
   await assert.rejects(send({keyword:'stale commander',timestamp:clock,testIds:[Number(peerId)]}),e=>[401,410].includes(e.statusCode));
   if(kind==='file'){const state=JSON.parse(await readFile(file,'utf8'));assert.ok(Object.values(state.originalNativeCommands).some(row=>row.testNumber===peerId));for(const row of Object.values(state.originalNativeCommands).filter(row=>row.testNumber===peerId))assert.equal(row.commanderParticipantSessionId,null);}
   if(kind==='sqlite'){const control=new DatabaseSync(file);try{const rows=control.prepare('SELECT commander_participant_session_id FROM original_native_commands WHERE test_number=?').all(peerId);assert.ok(rows.length);assert.ok(rows.every(row=>row.commander_participant_session_id===null));}finally{control.close();}}
   if(kind==='postgres'){const control=new Pool({connectionString:url.toString()});try{const rows=(await control.query('SELECT commander_participant_session_id FROM original_native_commands WHERE test_number=$1',[peerId])).rows;assert.ok(rows.length);assert.ok(rows.every(row=>row.commander_participant_session_id===null));}finally{await control.end();}}
  });
  await t.test('generic Test deletion physically retires native deliveries and never resets the global command counter',async()=>{
   const testScope=await current(peerId,peer.person),before=await repository.reserveOriginalCommandNumber();await repository.deleteTestRunsByIds([testScope.testRunId]);await assert.rejects(repository.listOriginalCommands(testScope,null));const after=await repository.reserveOriginalCommandNumber();assert.equal(BigInt(after),BigInt(before)+1n);
  });
 }finally{await close();if(created)await pool.query(`DROP SCHEMA "${schema}" CASCADE`);await pool?.end();await rm(dir,{recursive:true,force:true});}
});
