import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm,rename,stat,readFile} from 'node:fs/promises';
import {renameSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {Pool} from 'pg';
import {setTimeout} from 'node:timers/promises';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceStorage} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
import {prepareOriginalXmlSchemaValidator} from '../packages/application/dist/packages/application/src/original-xml-schema.js';
import {setupNativeSystemCheck,sourceReply,sourceSystemCheck,sourceWireReply,sourceSystemCheckWire,nativeUnitCheckXml,nativeSpeedCheckXml,systemCheckRoster,systemCheckXml} from './native-system-check-fixture.mjs';
const validator=await prepareOriginalXmlSchemaValidator(resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE||'.data/original-xml-schemas'),process.env.FIRST_SLICE_XML_SCHEMA_DOWNLOAD!=='false');
const kinds=['memory','file','sqlite',...(process.env.FIRST_SLICE_STORE==='postgres'?['postgres']:[])];
for(const kind of kinds)test(kind+': native Systemcheck protocol reads actual files and atomically saves authorized reports',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'owned-syscheck-wire-')),file=join(dir,kind==='file'?'state.json':'state.sqlite'),namespace='owned_syscheck_wire_'+randomUUID().replaceAll('-','');
 const pg=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;pg?.searchParams.set('options','-c search_path='+namespace);pg?.searchParams.set('application_name',namespace);
 let storage,repository,services,pool,control,beforeTransaction,beforeCommit,clock='2026-11-09T13:59:04.000Z';
 const open=async()=>{
  storage=kind==='memory'?storage??{repository:createInMemoryFirstSliceRepository(),shutdown:async()=>{}}:kind==='file'?await createFileFirstSliceStorage(file):kind==='sqlite'?createSqliteFirstSliceStorage(file):await createPostgresFirstSliceStorage(pg.toString());repository=storage.repository;
  services=createFirstSliceServices({repository:{...repository,async transactOriginalSystemCheck(selector,transform){if(beforeTransaction){const pending=beforeTransaction;beforeTransaction=undefined;await pending();}return repository.transactOriginalSystemCheck(selector,snapshot=>{const effect=transform(snapshot);if(beforeCommit){const pending=beforeCommit;beforeCommit=undefined;pending();}return effect;});}},originalXmlSchemaValidator:validator,xmlSchemaProfile:'original-19',now:()=>clock});
 };
 const close=async()=>{const current=storage;if(kind!=='memory')storage=undefined;await current?.shutdown();};
 try{
  if(pg){pool=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await pool.query('CREATE SCHEMA "'+namespace+'"');control=new Pool({connectionString:pg.toString()});}
  await open();if(kind==='sqlite')control=new DatabaseSync(file);
  const setup=await setupNativeSystemCheck(services,repository),{scope,ids,workspaceNumber}=setup;let actor=setup.actor;
  const request=(checkName='R99.UNITCHECK',token=actor.token)=>({workspaceNumber,checkName,token});
  const records=async()=>(await repository.listWorkspaceActivityEventsByWorkspace(ids.tenantId,ids.workspaceId)).filter(event=>event.eventType==='system_check_report_saved');
  const body={keyPhrase:'owned-wrong-key',title:'Must not become actor title',environment:[],network:[],questionnaire:[],unit:[],responses:[]};
  const expectNoWrite=async(operation,status)=>{const before=await records();await assert.rejects(operation,e=>e.statusCode===status);assert.deepEqual(await records(),before);};
  await t.test('config and empty Unit responses match actual anonymous and native-person Source replies',async()=>{
   for(const token of [undefined,'',actor.token]){
    assert.deepEqual(JSON.parse(await services.originalSystemCheck.config({workspaceNumber,checkName:'R98.CHECK',token})),sourceReply('config-anonymous').value);
    assert.deepEqual(await services.originalSystemCheck.unit({workspaceNumber,checkName:'R98.CHECK',token}),sourceReply('unit-anonymous').value);
   }
   assert.deepEqual(JSON.parse(await services.originalSystemCheck.config(request())),sourceReply('config-with-unit').value);
   assert.deepEqual(await services.originalSystemCheck.unit(request()),sourceReply('unit-with-player').value);
   await assert.rejects(services.originalSystemCheck.config(request('MISSING')),e=>e.statusCode===404&&e.message===sourceReply('config-missing').value);
  });
  await t.test('report check identity and authenticated title are server-owned and no Test or admin identity is created',async()=>{
   const admins=await repository.listAdminUsers(),people=await repository.listParticipantSessionsByWorkspace(ids.tenantId,ids.workspaceId);
   await services.originalSystemCheck.saveReport({...request(),body:{...body,checkId:'forged',checkLabel:'forged'}});
   const [event]=await records(),report=event.details.report;
   assert.equal(report.title,'r98-syscheck');assert.equal(report.checkId,'R99.UNITCHECK');assert.equal(report.checkLabel,'Owned Unit Check');assert.equal(report.responses,'');
   assert.equal(report.sourceDate,'2026-11-09 14:59:04');assert.equal(event.actorId,people.find(p=>p.loginKey==='r98-syscheck').participantSessionId);
   assert.deepEqual(await repository.listAdminUsers(),admins);assert.deepEqual(await repository.listParticipantSessionsByWorkspace(ids.tenantId,ids.workspaceId),people);
   assert.deepEqual(await repository.listTestRunsByWorkspace(ids.tenantId,ids.workspaceId),[]);
   const observed=Object.values(sourceSystemCheck.persistedReports).find(row=>row.title==='r98-syscheck'&&row.checkId==='R99.UNITCHECK');
   for(const key of ['title','checkId','checkLabel','environment','network','questionnaire','unit','responses'])assert.deepEqual(report[key],observed[key],key);
  });
  await t.test('config preserves Source lexical booleans, text, string sizes and exact PHP int64 speed tokens',async()=>{
   await services.contentIntake.uploadWorkspaceFile({...scope,fileName:'speed.xml',mediaType:'application/xml',sourceDocument:nativeSpeedCheckXml});
   const json=await services.originalSystemCheck.config(request('R100.SPEEDCHECK'));
   assert.equal(json,sourceWireReply('config-speed-lexical').rawText);
   assert.match(json,/"min":9007199254740993/);
   const value=JSON.parse(json);assert.equal(value.skipNetwork,false);assert.equal(value.questions[0].required,false);assert.deepEqual(value.questions[0].options,[' A ',' B ',' ']);assert.equal(value.downloadSpeed.sequenceSizes,0);
   const before=await repository.listSourcePackagesByWorkspace(ids.tenantId,ids.workspaceId);
   for(const sourceDocument of [nativeSpeedCheckXml.replace('min="9007199254740993"','min="1.5"'),nativeSpeedCheckXml.replace('min="9007199254740993"','')]){
    await assert.rejects(services.contentIntake.uploadWorkspaceFile({...scope,fileName:'invalid-speed.xml',mediaType:'application/xml',sourceDocument}),e=>e.statusCode===400);
    assert.deepEqual(await repository.listSourcePackagesByWorkspace(ids.tenantId,ids.workspaceId),before);
   }
  });
  await t.test('Source falsey string fields differ from explicit empty report dates',async()=>{
   const before=await records();await services.originalSystemCheck.saveReport({...request('R100.SPEEDCHECK'),body:{...body,date:'',responses:'0'}});
   const actual=(await records()).at(-1).details.report,observed=Object.values(sourceSystemCheckWire.persistedReports).find(row=>row.checkId==='R100.SPEEDCHECK');
   assert.equal(actual.sourceDate,observed.date);assert.equal(actual.responses,observed.responses);assert.equal(actual.title,observed.title);
   await services.originalSystemCheck.saveReport({...request(),token:undefined,body:{...body,keyPhrase:'OWNED-KEY',title:'0',date:'0',responses:'0'}});
   const anonymous=(await records()).at(-1).details.report,zero=Object.values(sourceSystemCheckWire.persistedReports).find(row=>row.title==='');
   assert.equal(anonymous.title,zero.title);assert.equal(anonymous.responses,zero.responses);assert.equal(anonymous.sourceDate,'2026-11-09 14:59:04');
   await expectNoWrite(()=>services.originalSystemCheck.saveReport({...request('R100.SPEEDCHECK'),token:undefined,body:{...body,keyPhrase:'0'}}),400);
   assert.equal((await records()).length,before.length+2);
  });
  await t.test('external Unit definition and Player reads retain the exact Source UTF-8 BOM and resource bytes',async()=>{
   const observed=sourceWireReply('unit-definition-ref-bom').value;
   await services.contentIntake.uploadWorkspaceFile({...scope,fileName:'owned-bom-player-1.0.html',mediaType:'text/html',sourceDocument:observed.player});
   await services.contentIntake.uploadWorkspaceFile({...scope,fileName:'owned-bom-definition.json',mediaType:'application/json',sourceDocument:observed.def});
   await services.contentIntake.uploadWorkspaceFile({...scope,fileName:'unit-bom.xml',mediaType:'application/xml',sourceDocument:systemCheckXml('Unit','<Metadata><Id>R100.BOM.UNIT</Id><Label>Owned referenced Unit</Label></Metadata><DefinitionRef player="owned-bom-player-1.0">owned-bom-definition.json</DefinitionRef>')});
   await services.contentIntake.uploadWorkspaceFile({...scope,fileName:'syscheck-bom.xml',mediaType:'application/xml',sourceDocument:systemCheckXml('SysCheck','<Metadata><Id>R100.BOMCHECK</Id><Label>Owned reference Check</Label></Metadata><Config unit="R100.BOM.UNIT"/>')});
   assert.deepEqual(await services.originalSystemCheck.unit(request('R100.BOMCHECK')),observed);assert.equal(observed.def.charCodeAt(0),0xfeff);assert.equal(observed.player.charCodeAt(0),0xfeff);
  });
  await t.test('preserve canSave and dedicated-role boundaries despite the Source counterexamples',async()=>{
   await expectNoWrite(()=>services.originalSystemCheck.saveReport({...request('R98.CHECK'),body}),409);
   await expectNoWrite(()=>services.originalSystemCheck.saveReport({...request('R99.UNITCHECK',setup.monitor.token),body}),403);
   await assert.rejects(services.originalSystemCheck.config(request('R99.UNITCHECK',setup.monitor.token)),e=>e.statusCode===403);
   await expectNoWrite(()=>services.originalSystemCheck.saveReport({...request('R99.UNITCHECK',actor.groupToken),body}),403);
   await expectNoWrite(()=>services.originalSystemCheck.saveReport({...request('R99.UNITCHECK','owned-invalid-token'),body}),403);
  });
  await t.test('anonymous writes require the case-insensitive exact key and retain authored text and questionnaire entries',async()=>{
   for(const [keyPhrase,status]of [['',400],['owned-wrong-key',403],[' OWNED-KEY ',403]])await expectNoWrite(()=>services.originalSystemCheck.saveReport({...request('R99.UNITCHECK',undefined),token:undefined,body:{...body,keyPhrase}}),status);
   const questionnaire=[{id:' exact ',type:'string',label:'  authored label  ',value:'  exact answer  ',warning:false}];
   await services.originalSystemCheck.saveReport({...request(),token:undefined,body:{...body,keyPhrase:'OWNED-KEY',title:'  Owned anonymous  ',questionnaire,responses:[{id:'owned',value:'exact'}]}});
   const report=(await records()).at(-1).details.report;assert.equal(report.title,'  Owned anonymous  ');assert.deepEqual(report.questionnaire,questionnaire);assert.deepEqual(report.responses,[{id:'owned',value:'exact'}]);
  });
  await t.test('save-key matching preserves PHP ASCII casing instead of admitting additional Unicode variants',async()=>{
   await services.contentIntake.uploadWorkspaceFile({...scope,fileName:'unicode-key.xml',mediaType:'application/xml',sourceDocument:systemCheckXml('SysCheck','<Metadata><Id>OWNED.UNICODE.CHECK</Id><Label>Owned Unicode key</Label></Metadata><Config savekey="ä-Key"/>')});
   await expectNoWrite(()=>services.originalSystemCheck.saveReport({...request('OWNED.UNICODE.CHECK'),token:undefined,body:{...body,keyPhrase:'Ä-KEY'}}),403);
   await services.originalSystemCheck.saveReport({...request('OWNED.UNICODE.CHECK'),token:undefined,body:{...body,keyPhrase:'ä-kEy'}});
  });
  await t.test('the same check ID in another workspace never grants a native person cross-workspace access',async()=>{
   const peer=await services.platform.createWorkspace({tenantKey:scope.tenantKey,workspaceKey:'peer',displayName:'Owned peer'});
   await services.contentIntake.uploadWorkspaceFile({tenantKey:scope.tenantKey,workspaceKey:peer.workspaceKey,fileName:'peer.xml',mediaType:'application/xml',sourceDocument:nativeUnitCheckXml.replace('unit="R98.UNIT" ','')});
   const peerNumber=await repository.getOrCreateOriginalWorkspaceNumber({tenantId:ids.tenantId,workspaceId:peer.workspaceId});
   await assert.rejects(services.originalSystemCheck.config({...request(),workspaceNumber:peerNumber}),e=>e.statusCode===403);
   await expectNoWrite(()=>services.originalSystemCheck.saveReport({...request(),workspaceNumber:peerNumber,body}),403);
   assert.equal((await repository.listWorkspaceActivityEventsByWorkspace(ids.tenantId,peer.workspaceId)).some(event=>event.eventType==='system_check_report_saved'),false);
  });
  await t.test('restart retains report evidence and current physical file reads',async()=>{
   const before=await records();await close();await open();assert.deepEqual(await records(),before);
   assert.deepEqual(await services.originalSystemCheck.unit(request()),sourceReply('unit-with-player').value);
  });
  if(kind==='file')await t.test('anonymous config and Unit reads do not replace or rewrite the file manifest',async()=>{
   const before=await stat(file,{bigint:true}),bytes=await readFile(file);
   await services.originalSystemCheck.config({...request(),token:undefined});await services.originalSystemCheck.unit({...request(),token:undefined});
   const after=await stat(file,{bigint:true});assert.equal(after.ino,before.ino);assert.equal(after.mtimeNs,before.mtimeNs);assert.deepEqual(await readFile(file),bytes);
  });
  await t.test('logout between preflight and the durable transaction rejects the report without a write',async()=>{
   beforeTransaction=()=>services.originalSession.logout({token:actor.token});await expectNoWrite(()=>services.originalSystemCheck.saveReport({...request(),body}),403);
   actor=await services.originalSession.login({name:'r98-syscheck',password:'owned-r98-theme-password'});
  });
  await t.test('role replacement and loss of XML provenance after preflight are checked again inside the writer',async()=>{
   beforeTransaction=()=>services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:systemCheckRoster('monitor-group')});
   await expectNoWrite(()=>services.originalSystemCheck.saveReport({...request(),body}),403);
   await services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:systemCheckRoster()});actor=await services.originalSession.login({name:'r98-syscheck',password:'owned-r98-theme-password'});
   beforeTransaction=async()=>{const candidates=await repository.listOperationalLoginMigrationCandidatesByWorkspace(ids.tenantId,ids.workspaceId);await repository.replaceOperationalLoginMigrationCandidatesByWorkspace(ids.tenantId,ids.workspaceId,candidates);};
   await expectNoWrite(()=>services.originalSystemCheck.saveReport({...request(),body}),403);
   await services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:systemCheckRoster()});actor=await services.originalSession.login({name:'r98-syscheck',password:'owned-r98-theme-password'});
  });
  await t.test('clock crossing person expiry while waiting for the writer is rejected',async()=>{
   const person=(await services.originalAuthentication.read({token:actor.token})).participantSession;
   await repository.updateParticipantSessionValidity({...person,validUntil:'2026-11-09T13:59:05.000Z'});
   beforeTransaction=async()=>{clock='2026-11-09T13:59:06.000Z';};await expectNoWrite(()=>services.originalSystemCheck.saveReport({...request(),body}),410);
   clock='2026-11-09T13:59:04.000Z';await repository.updateParticipantSessionValidity({...person,validUntil:null});
  });
  await t.test('physical config replacement while waiting for the writer cannot retain obsolete report-saving permission',async()=>{
   const previous=(await repository.listSourcePackagesByWorkspace(ids.tenantId,ids.workspaceId)).find(source=>/(^|\/)syscheck-unit\.xml$/.test(source.fileName));assert.ok(previous);
   let replacement;beforeTransaction=async()=>{replacement=await services.contentIntake.replaceWorkspaceFile({...scope,sourcePackageId:previous.sourcePackageId,mediaType:'application/xml',sourceDocument:nativeUnitCheckXml.replace('savekey="owned-key" ','')});};
   await expectNoWrite(()=>services.originalSystemCheck.saveReport({...request(),body}),409);
   assert.equal(JSON.parse(await services.originalSystemCheck.config(request())).canSave,false);
   await services.contentIntake.replaceWorkspaceFile({...scope,sourcePackageId:replacement.replacementSourcePackage.sourcePackageId,mediaType:'application/xml',sourceDocument:nativeUnitCheckXml});
   assert.equal(JSON.parse(await services.originalSystemCheck.config(request())).canSave,true);
  });
  await t.test('archived workspace and suspended tenant after preflight cannot receive a report',async()=>{
   const workspace=await repository.getWorkspaceByScope(scope.tenantKey,scope.workspaceKey),tenant=await repository.getTenantByKey(scope.tenantKey);
   beforeTransaction=()=>repository.saveWorkspace({...scope,workspace:{...workspace,status:'archived'}});
   await expectNoWrite(()=>services.originalSystemCheck.saveReport({...request(),body}),404);await repository.saveWorkspace({...scope,workspace});
   beforeTransaction=()=>repository.saveTenant({...tenant,status:'suspended'});
   await expectNoWrite(()=>services.originalSystemCheck.saveReport({...request(),body}),404);await repository.saveTenant(tenant);
  });
  if(control)await t.test('a late activity INSERT failure rolls back the complete native report',async()=>{
   const install=kind==='sqlite'?"CREATE TRIGGER owned_syscheck_failure BEFORE INSERT ON workspace_activity_events WHEN NEW.event_type='system_check_report_saved' BEGIN SELECT RAISE(ABORT,'owned syscheck insert failure'); END":
    "CREATE FUNCTION owned_syscheck_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned syscheck insert failure'; END $$; CREATE TRIGGER owned_syscheck_failure BEFORE INSERT ON workspace_activity_events FOR EACH ROW WHEN (NEW.event_type='system_check_report_saved') EXECUTE FUNCTION owned_syscheck_failure()";
   const remove=kind==='sqlite'?'DROP TRIGGER owned_syscheck_failure':'DROP TRIGGER owned_syscheck_failure ON workspace_activity_events; DROP FUNCTION owned_syscheck_failure()';
   const execute=sql=>kind==='sqlite'?control.exec(sql):control.query(sql),before=await records();await execute(install);
   try{await assert.rejects(services.originalSystemCheck.saveReport({...request(),body}),/owned syscheck insert failure/);assert.deepEqual(await records(),before);}finally{await execute(remove);}
  });
  if(kind==='file')await t.test('a failed manifest commit retains the cached and durable report inventory',async()=>{
   const before=await records();beforeCommit=()=>{renameSync(file,file+'.backup');mkdirSync(file);};
   try{await assert.rejects(services.originalSystemCheck.saveReport({...request(),body}));}finally{await rm(file,{recursive:true,force:true});await rename(file+'.backup',file);}
   assert.deepEqual(await records(),before);
   await close();await open();assert.deepEqual(await records(),before);
  });
  if(kind==='postgres')await t.test('an actual queued PostgreSQL writer sees logout committed by another connection',async()=>{
   const before=await records(),held=await control.connect();let pending;
   try{
    await held.query('BEGIN');await held.query('SELECT pg_advisory_xact_lock(1413693779, hashtext(current_schema()))');
    pending=services.originalSystemCheck.saveReport({...request(),body}).then(value=>({value}),error=>({error}));
    let waiting=false;const deadline=Date.now()+5000;
    while(Date.now()<deadline){const active=await control.query("SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE 'SELECT pg_advisory_xact_lock(1413693779,%'",[namespace]);if(active.rowCount){waiting=true;break;}await setTimeout(10);}
    assert.equal(waiting,true,'The report must be observed waiting on its real durable-writer lock.');
    await services.originalSession.logout({token:actor.token});await held.query('COMMIT');
    const result=await pending;assert.equal(result.error?.statusCode,403);assert.deepEqual(await records(),before);
   }finally{await held.query('ROLLBACK');held.release();if(pending)await pending;}
   actor=await services.originalSession.login({name:'r98-syscheck',password:'owned-r98-theme-password'});
  });
  await t.test('canonical system-check login mode also blocks anonymous native saves; native Systemcheck identity remains its own authority',async()=>{
   const credentials={username:'owned-syscheck-root',password:'Owned syscheck root password'};await services.adminAuth.bootstrapAdminUser(credentials);const {adminUser}=await services.adminAuth.signIn(credentials);
   await repository.saveAdminRoleAssignment({roleAssignmentId:randomUUID(),adminUserId:adminUser.adminUserId,role:'system_check',accessMode:'read_write',tenantId:ids.tenantId,workspaceId:ids.workspaceId,groupKey:null,createdAt:clock});
   await expectNoWrite(()=>services.originalSystemCheck.saveReport({...request(),token:undefined,body:{...body,keyPhrase:'OWNED-KEY'}}),401);
   await services.originalSystemCheck.saveReport({...request(),body});
  });
 }finally{await close();if(kind==='sqlite')control?.close();if(kind==='postgres')await control?.end();if(pool){await pool.query('DROP SCHEMA "'+namespace+'" CASCADE');await pool.end();}await rm(dir,{recursive:true,force:true});}
});
