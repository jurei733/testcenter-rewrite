import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {prepareOriginalXmlSchemaValidator} from '../packages/application/dist/packages/application/src/original-xml-schema.js';
const originalXmlSchemaValidator=await prepareOriginalXmlSchemaValidator(resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE || '.data/original-xml-schemas'),process.env.FIRST_SLICE_XML_SCHEMA_DOWNLOAD !== 'false');
import {Pool} from 'pg';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceRepository} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';

const metadata={
 $schema:'https://raw.githubusercontent.com/verona-interfaces/metadata/master/verona-module-metadata.json',
 id:'live-player',version:'1.2.9',specVersion:'6.0',metadataVersion:'2.0',type:'player',
 name:[{lang:'de',value:'Owned live player'}]
};
const player=body=>'<html><script type="application/ld+json">'+JSON.stringify(metadata)+'</script><main>'+body+'</main></html>';
const schemas={Unit:['unit-xml','17.6'],Booklet:['testcenter-booklet-xml','18.0'],Testtakers:['testcenter-testtaker-xml','18.0'],SysCheck:['testcenter-syscheck-xml','18.0']};
const xml=(type,id,body)=>`<${type} xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/${schemas[type].join('/')}"><Metadata>${type==='Testtakers'?'':`<Id>${id}</Id><Label>${id}</Label>`}</Metadata>${body}</${type}>`;
const unit=body=>xml('Unit','LIVE.UNIT',`<Definition player="live-player@1.2.9"><![CDATA[${body}]]></Definition>`);
const booklet=id=>xml('Booklet',id,'<Units><Testlet id="TIMER"><Restrictions><TimeMax minutes="5" leave="allowed"/></Restrictions><Unit id="LIVE.UNIT" label="Live Unit"/></Testlet></Units>');
const roster=ids=>xml('Testtakers','LIVE.PEOPLE','<Group id="owned" label="Owned"><Login name="live-person" mode="run-hot-return">'+ids.map(id=>'<Booklet>'+id+'</Booklet>').join('')+'</Login></Group>');

const kinds=process.env.FIRST_SLICE_STORE==='postgres'?['postgres']:['memory','file','sqlite'];
for(const kind of kinds)test(kind+': Source files become live without manual activation and retain test identities across current definitions',async t=>{
 const folder=await mkdtemp(join(tmpdir(),'owned-live-files-'));
 const schema='owned_live_'+randomUUID().replaceAll('-','');
 let pool,storage;
 const pg=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;
 pg?.searchParams.set('options','-c search_path='+schema);
 try{
 if(pg){pool=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await pool.query('CREATE SCHEMA \"'+schema+'\"');}
 const repository=kind==='memory'?createInMemoryFirstSliceRepository():kind==='file'?createFileFirstSliceRepository(join(folder,'owned.json')):
  (storage=kind==='sqlite'?createSqliteFirstSliceStorage(join(folder,'owned.sqlite')):await createPostgresFirstSliceStorage(pg.toString())).repository;
 const services=createFirstSliceServices({repository,xmlSchemaProfile:'original-19',originalXmlSchemaValidator,now:()=> '2026-10-23T12:00:00.000Z'});
 const tenant=await services.platform.createTenant({tenantKey:'live-'+randomUUID(),displayName:'Owned live'});
 const workspace=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'live',displayName:'Owned live'});
 const scope={tenantKey:tenant.tenantKey,workspaceKey:workspace.workspaceKey};
 const upload=(fileName,sourceDocument,mediaType='application/xml')=>services.contentIntake.uploadWorkspaceFile({...scope,fileName,sourceDocument,mediaType}).catch(error=>assert.fail(JSON.stringify({fileName,code:error.errorCode,details:error.details})));
 let parent,run,initialOrigin,protectedFields;
 await t.test('a normal Source upload makes the whole workspace available without calling activateContentRelease',async()=>{
  await upload('player.html',player('Player version one'),'text/html');
  await upload('unit.xml',unit('Definition version one'));
  const result=await upload('a.xml',booklet('LIVE.A'));
  assert.equal(result.workspaceAvailability?.status,'available',JSON.stringify(result));
  await upload('people.xml',roster(['LIVE.A']));
  parent=await services.participantRuntime.signIn({...scope,loginKey:'live-person'});
  initialOrigin=structuredClone(await repository.getContentReleaseById(parent.contentReleaseId));
  assert.ok(initialOrigin.runtimeSnapshot.workspaceFilePublication);
  const state=await services.participantRuntime.getRuntimeState({participantSessionId:parent.participantSessionId});
  assert.deepEqual(state.booklets.map(row=>row.sourceBookletKey),['LIVE.A']);
  run=await services.participantRuntime.launch({participantSessionId:parent.participantSessionId,bookletKey:'LIVE.A'});
  await services.participantRuntime.saveProgress({testRunId:run.testRunId,unitResponse:'  Saved answer Ω\n  ',status:'paused'});
  const current=await services.participantRuntime.getCurrentRunState({participantSessionId:parent.participantSessionId,testRunId:run.testRunId,includeBookletAssets:true});
  assert.match(JSON.stringify(current.bookletAssets),/Definition version one/);assert.match(JSON.stringify(current.bookletAssets),/Player version one/);
  const persisted=await repository.getTestRunById(run.testRunId);
  assert.ok(Object.keys(persisted.testletTimers).length,'The real authored TimeMax must have a stored clock.');
  protectedFields=Object.fromEntries(['unitResponses','unitResponseFieldTimestamps','testletTimers','bookletAssignmentKey','currentUnitKey'].map(key=>[key,persisted[key]]));
 });
 await t.test('a Syscheck resolves current definitions while its choices retain metadata only',async()=>{
  await upload('check.xml',xml('SysCheck','LIVE.CHECK','<Config unit="LIVE.UNIT" savekey="private-live-key" skipnetwork="true"/>'));
  const check=await services.systemCheck.getSystemCheck({...scope,checkId:'LIVE.CHECK'});
  assert.equal(check.canSave,true);assert.match(check.unit.unitDefinition,/Definition version one/);assert.match(check.unit.playerHtml,/Player version one/);
  const choices=await services.systemCheck.listSystemCheckChoices({scopes:[scope]});assert.equal(choices.length,1);
  for(const secret of ['private-live-key','Definition version one','Player version one','saveKey','unitEntry','playerHtml'])assert.ok(!JSON.stringify(choices).includes(secret),secret);
 });
 await t.test('Unit, Player and free resource replacements use current exact bytes without publishing replacement test identities',async()=>{
  const releaseCount=(await repository.listContentReleasesByWorkspace(tenant.tenantId,workspace.workspaceId)).length;
  const beforeCount=(await repository.listImportJobsByWorkspace(tenant.tenantId,workspace.workspaceId)).length;
  await upload('unit.xml',unit('Definition version two Ω'));
  await upload('player.html',player('Player version two Ω'),'text/html');
  await upload('extra.txt',' exact resource one Ω\n','text/plain');
  await upload('extra.txt',' exact resource two Ω\n','text/plain');
  const current=await services.participantRuntime.getCurrentRunState({participantSessionId:parent.participantSessionId,testRunId:run.testRunId,includeBookletAssets:true});
  const bytes=JSON.stringify(current.bookletAssets);assert.match(bytes,/Definition version two Ω/);assert.match(bytes,/Player version two Ω/);
  assert.ok(!bytes.includes('Definition version one'));assert.ok(!bytes.includes('Player version one'));
  const resource=await services.participantRuntime.getResource({participantSessionId:parent.participantSessionId,resourcePath:'extra.txt'});
  assert.equal(Buffer.from(resource.dataBase64,'base64').toString(),' exact resource two Ω\n');
  await assert.rejects(services.participantRuntime.getResource({participantSessionId:parent.participantSessionId,resourcePath:'Testtakers/people.xml'}),error=>error.errorCode==='participant_resource_not_found');
  await repository.saveSourcePackage({sourcePackageId:randomUUID(),tenantId:tenant.tenantId,workspaceId:workspace.workspaceId,
   fileName:'private-roster.json',mediaType:'application/json',sourceDocument:'{"groups":[{"logins":[{"name":"secret","password":"private-roster-password"}]}]}',contentStructure:null,status:'accepted',uploadedAt:'2026-10-23T12:00:00.000Z'});
  await assert.rejects(services.participantRuntime.getResource({participantSessionId:parent.participantSessionId,resourcePath:'private-roster.json'}),error=>error.errorCode==='participant_resource_not_found');
  const check=await services.systemCheck.getSystemCheck({...scope,checkId:'LIVE.CHECK'});
  assert.match(check.unit.unitDefinition,/Definition version two Ω/);assert.match(check.unit.playerHtml,/Player version two Ω/);
  const report={...scope,checkId:'LIVE.CHECK',environment:[],network:[],questionnaire:[],unit:[],responses:'Owned report'};
  await assert.rejects(services.systemCheck.saveSystemCheckReport({...report,keyPhrase:'wrong'}),error=>error.errorCode==='system_check_save_key_invalid');
  const saved=await services.systemCheck.saveSystemCheckReport({...report,keyPhrase:'private-live-key'});assert.equal(saved.checkId,'LIVE.CHECK');

  const after=await repository.getTestRunById(run.testRunId);
  assert.deepEqual(Object.fromEntries(Object.keys(protectedFields).map(key=>[key,after[key]])),protectedFields);
  assert.deepEqual(await repository.getContentReleaseById(initialOrigin.contentReleaseId),initialOrigin,'The live view must not rewrite the historical release artifact.');
  assert.equal((await repository.listContentReleasesByWorkspace(tenant.tenantId,workspace.workspaceId)).length,releaseCount);
  assert.equal((await repository.listImportJobsByWorkspace(tenant.tenantId,workspace.workspaceId)).length,beforeCount);
 });
 await t.test('a later Booklet joins the same workspace and the same participant session',async()=>{
  await upload('b.xml',booklet('LIVE.B'));await upload('people.xml',roster(['LIVE.A','LIVE.B']));
  const reentered=await services.participantRuntime.signIn({...scope,loginKey:'live-person'});assert.equal(reentered.participantSessionId,parent.participantSessionId);
  const state=await services.participantRuntime.getRuntimeState({participantSessionId:parent.participantSessionId});
  assert.deepEqual(state.booklets.map(row=>row.sourceBookletKey).sort(),['LIVE.A','LIVE.B']);
  const beforeRuns=await repository.listTestRunsByParticipantSessionId(parent.participantSessionId);
  const summary=await services.workspaceAdminRead.getStudyMonitorSummary(scope);
  const expected=summary.bookletProgress.find(row=>row.bookletKey==='LIVE.B');
  assert.equal(expected.expectedParticipantCount,1);assert.equal(expected.notStartedCount,1);
  const beforeStart=await services.workspaceAdminRead.getStudyMonitorBookletDetail({...scope,bookletKey:'LIVE.B'});
  assert.equal(beforeStart.expectedParticipantCount,expected.expectedParticipantCount);
  assert.equal(beforeStart.notStartedCount,1);assert.equal(beforeStart.rosterEntryCount,1);
  assert.equal(beforeStart.testRunCount,0);assert.equal(beforeStart.participantSessionCount,0);
  assert.equal(beforeStart.unitProgress[0].rosterExpectedCount,1);
  assert.equal(beforeStart.unitProgress[0].missingResponseCount,1);
  assert.equal(beforeStart.rosterEntries[0].loginKey,'live-person');
  assert.deepEqual(await repository.listTestRunsByParticipantSessionId(parent.participantSessionId),beforeRuns);
  const second=await services.participantRuntime.launch({participantSessionId:parent.participantSessionId,bookletKey:'LIVE.B'});
  assert.notEqual(second.testRunId,run.testRunId);assert.equal(second.contentReleaseId,run.contentReleaseId);
  const monitor=await services.workspaceAdminRead.getStudyMonitorBookletDetail({...scope,bookletKey:state.booklets.find(row=>row.sourceBookletKey==='LIVE.B').bookletKey});
  assert.equal(monitor.displayLabel,'LIVE.B');assert.equal(monitor.expectedParticipantCount,1);
  assert.equal(monitor.notStartedCount,0);assert.equal(monitor.rosterEntryCount,1);
  assert.equal(monitor.participantSessionCount,1);assert.equal(monitor.testRunCount,1);
  await services.participantRuntime.saveProgress({testRunId:second.testRunId,unitResponse:'Saved B',status:'running'});
  await services.participantRuntime.completeRun({testRunId:second.testRunId,confirmTestletTimeLeave:true,confirmTestletLeaveLock:true});
  await services.participantRuntime.resumeRun({testRunId:run.testRunId});
  await services.participantRuntime.completeRun({testRunId:run.testRunId,confirmTestletTimeLeave:true,confirmTestletLeaveLock:true});
 });
 await t.test('finishing and signing in again retains the same completed tests and saved answers',async()=>{
  const before=structuredClone(await repository.listTestRunsByParticipantSessionId(parent.participantSessionId));
  assert.ok(before.every(row=>row.status==='completed'));
  const reentered=await services.participantRuntime.signIn({...scope,loginKey:'live-person'});assert.equal(reentered.participantSessionId,parent.participantSessionId);
  assert.deepEqual(await repository.listTestRunsByParticipantSessionId(parent.participantSessionId),before);
  assert.equal((await repository.listParticipantSessionsByWorkspace(tenant.tenantId,workspace.workspaceId)).length,1);
  assert.deepEqual(await repository.getContentReleaseById(initialOrigin.contentReleaseId),initialOrigin);
 });
 await t.test('canonical sessions stay pinned when later native edits restore the fixed Source origin',async()=>{
  const canonical={...structuredClone(initialOrigin),contentReleaseId:randomUUID(),releaseLabel:'Owned canonical snapshot',status:'staged',activatedAt:null};
  delete canonical.runtimeSnapshot.workspaceFilePublication;
  await repository.saveContentRelease(canonical);
  await services.contentIntake.activateContentRelease({...scope,contentReleaseId:canonical.contentReleaseId});
  // An active release is not part of native person identity. Establish the
  // separate canonical contract through an actual canonical roster account.
  const nativeUnderCanonical=await services.participantRuntime.signIn({...scope,loginKey:'live-person'});
  assert.equal(nativeUnderCanonical.participantSessionId,parent.participantSessionId);
  assert.equal(nativeUnderCanonical.contentReleaseId,initialOrigin.contentReleaseId);
  await services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:JSON.stringify([{loginKey:'canonical-person',groupKey:'owned',booklets:[{id:'LIVE.A'}]}])});
  const pinned=await services.participantRuntime.signIn({...scope,loginKey:'canonical-person'});
  assert.equal(pinned.originalLoginKey,undefined);assert.equal(pinned.contentReleaseId,canonical.contentReleaseId);
  assert.notEqual(pinned.participantSessionId,parent.participantSessionId);
  const pinnedRun=await services.participantRuntime.launch({participantSessionId:pinned.participantSessionId,bookletKey:'LIVE.A'});
  await services.participantRuntime.saveProgress({testRunId:pinnedRun.testRunId,status:'paused',unitResponse:'Pinned canonical answer Ω'});
  const before=await repository.getTestRunById(pinnedRun.testRunId);
  const changed=await upload('unit.xml',unit('Definition version three Ω'));
  assert.equal(changed.workspaceAvailability.status,'available');assert.equal(changed.workspaceAvailability.contentReleaseId,initialOrigin.contentReleaseId);
  const pinnedState=await services.participantRuntime.getCurrentRunState({participantSessionId:pinned.participantSessionId,testRunId:pinnedRun.testRunId,includeBookletAssets:true});
  assert.match(JSON.stringify(pinnedState.bookletAssets),/Definition version one/);
  assert.ok(!JSON.stringify(pinnedState.bookletAssets).includes('Definition version three'));
  assert.deepEqual(await repository.getTestRunById(pinnedRun.testRunId),before);
  const returned=await services.participantRuntime.signIn({...scope,loginKey:'live-person'});
  assert.equal(returned.participantSessionId,parent.participantSessionId);
  const liveState=await services.participantRuntime.getCurrentRunState({participantSessionId:parent.participantSessionId,testRunId:run.testRunId,includeBookletAssets:true});
  assert.match(JSON.stringify(liveState.bookletAssets),/Definition version three Ω/);
  assert.deepEqual((await repository.getContentReleaseById(initialOrigin.contentReleaseId)).runtimeSnapshot,initialOrigin.runtimeSnapshot);
 });
 await t.test('a replaced Syscheck save key takes effect without exposing it in choices',async()=>{
  await upload('check.xml',xml('SysCheck','LIVE.CHECK','<Config unit="LIVE.UNIT" savekey="private-replaced-key" skipnetwork="true"/>'));
  const report={...scope,checkId:'LIVE.CHECK',environment:[],network:[],questionnaire:[],unit:[],responses:'Replacement key report'};
  await assert.rejects(services.systemCheck.saveSystemCheckReport({...report,keyPhrase:'private-live-key'}),error=>error.errorCode==='system_check_save_key_invalid');
  assert.equal((await services.systemCheck.saveSystemCheckReport({...report,keyPhrase:'private-replaced-key'})).checkId,'LIVE.CHECK');
  const choices=await services.systemCheck.listSystemCheckChoices({scopes:[scope]});assert.equal(choices.length,1);
  assert.ok(!JSON.stringify(choices).includes('private-replaced-key'));
 });
 await t.test('canonical Syschecks retain their imported identity and definition alongside native current files',async()=>{
  await services.platform.createWorkspace({tenantKey:scope.tenantKey,workspaceKey:'canonical',displayName:'Owned canonical checks'});
  const other={tenantKey:scope.tenantKey,workspaceKey:'canonical'};
  for(const [fileName,sourceDocument,mediaType]of [['player.html',player('Pinned canonical Player'),'text/html'],
   ['unit.xml',unit('Pinned canonical Unit'),'application/xml']]){
    await services.contentIntake.createSourcePackage({...other,fileName,sourceDocument,mediaType});
  }
  const source=await services.contentIntake.createSourcePackage({...other,fileName:'canonical.xml',mediaType:'application/xml',
   sourceDocument:xml('SysCheck','CANONICAL.CHECK','<Config unit="LIVE.UNIT" savekey="canonical-private-key" skipnetwork="true"/>')});
  const imported=await services.contentIntake.createImportJob({...other,sourcePackageId:source.sourcePackageId});
  assert.equal(imported.status,'completed');assert.notEqual(imported.sourcePackageId,source.sourcePackageId);
  const pinned=await services.systemCheck.getSystemCheck({...other,checkId:'CANONICAL.CHECK'});
  assert.equal(pinned.sourcePackageId,imported.sourcePackageId);assert.equal(pinned.unit.unitDefinition,'Pinned canonical Unit');
  const native=await services.contentIntake.uploadWorkspaceFile({...other,fileName:'native.xml',mediaType:'application/xml',
   sourceDocument:xml('SysCheck','NATIVE.OTHER','<Config unit="LIVE.UNIT" savekey="native-private-key" skipnetwork="true"/>')});
  assert.equal(native.workspaceAvailability.status,'available');
  await services.contentIntake.uploadWorkspaceFile({...other,fileName:'unit.xml',mediaType:'application/xml',sourceDocument:unit('Current native Unit')});
  assert.deepEqual(await services.systemCheck.getSystemCheck({...other,checkId:'CANONICAL.CHECK'}),pinned);
  const current=await services.systemCheck.getSystemCheck({...other,checkId:'NATIVE.OTHER'});
  assert.equal(current.sourcePackageId,native.sourcePackage.sourcePackageId);assert.equal(current.unit.unitDefinition,'Current native Unit');
 });
 }finally{if(storage)await storage.shutdown();if(pool){await pool.query('DROP SCHEMA \"'+schema+'\" CASCADE');await pool.end();}await rm(folder,{recursive:true,force:true});}
});
