import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {Pool} from 'pg';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceStorage} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
import {prepareOriginalXmlSchemaValidator} from '../packages/application/dist/packages/application/src/original-xml-schema.js';
const validator=await prepareOriginalXmlSchemaValidator(resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE||'.data/original-xml-schemas'),process.env.FIRST_SLICE_XML_SCHEMA_DOWNLOAD!=='false');
const fixture=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-syscheck-http/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',fixture)));
for(const [name,digest]of Object.entries(manifest.files)){
 assert.match(name,/^[a-z0-9.-]+$/);
 assert.equal(createHash('sha256').update(await readFile(new URL(name,fixture))).digest('hex'),digest);
}
const source=JSON.parse(await readFile(new URL('observations.json',fixture)));
assert.equal(manifest.sourceFilesVerifiedBeforeAndAfter,137);
assert.equal(source.actualSourceBackend,true);assert.equal(source.actualSourceFrontend,false);
assert.equal(source.sqlSeedsOrDaoStubs,false);assert.equal(source.rows.length,62);
assert.deepEqual(source.configuration,{xmlSchemaValidation:true,allowTestMode:false,bruteForceProtection:'login person'});
assert.equal(Object.keys(source.persistedReports).length,4);
// These observed Source weaknesses are counter-evidence, never authorization
// requirements for the Rewrite's role/workspace/canSave fences.
assert.equal(source.rows.find(row=>row.label==='save-as-monitor-source-counterexample').status,201);
assert.equal(source.rows.find(row=>row.label==='save-own-no-save-key-authenticated').status,201);
const expected=source.rows.find(row=>row.label==='auth-r98-syscheck').value;
const schema={Testtakers:'testcenter-testtaker-xml/18.0',SysCheck:'testcenter-syscheck-xml/18.0',Unit:'unit-xml/17.6',Booklet:'testcenter-booklet-xml/18.0'};
const xml=(name,body)=>'<'+name+' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/'+schema[name]+'">'+body+'</'+name+'>';
const kinds=['memory','file','sqlite',...(process.env.FIRST_SLICE_STORE==='postgres'?['postgres']:[])];
for(const kind of kinds)test(kind+': actual Source Syscheck identity, claims and role boundaries survive durable reentry',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'owned-native-syscheck-')),file=join(dir,kind==='file'?'state.json':'state.sqlite'),namespace='owned_syscheck_'+randomUUID().replaceAll('-','');
 const pg=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;pg?.searchParams.set('options','-c search_path='+namespace);
 let storage,repository,services,pool;const now=()=> '2026-11-09T08:00:00.000Z';
 const open=async()=>{storage=kind==='memory'?storage??{repository:createInMemoryFirstSliceRepository(),shutdown:async()=>{}}:kind==='file'?await createFileFirstSliceStorage(file):kind==='sqlite'?createSqliteFirstSliceStorage(file):await createPostgresFirstSliceStorage(pg.toString());repository=storage.repository;services=createFirstSliceServices({repository,originalXmlSchemaValidator:validator,xmlSchemaProfile:'original-19',now});};
 const close=async()=>{const owned=storage;if(kind!=='memory')storage=undefined;await owned?.shutdown();};
 try{
  if(pg){pool=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await pool.query('CREATE SCHEMA "'+namespace+'"');}
  await open();const tenant=await services.platform.createTenant({tenantKey:'owned-'+randomUUID(),displayName:'Owned Syscheck'}),workspace=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'owned',displayName:'Owned Syscheck'});
  const scope={tenantKey:tenant.tenantKey,workspaceKey:workspace.workspaceKey},ids=[tenant.tenantId,workspace.workspaceId];
  const uploadFile=(fileName,sourceDocument,mediaType='application/xml')=>services.contentIntake.uploadWorkspaceFile({...scope,fileName,sourceDocument,mediaType});
  let groupAssets='',userAssets='';
  const document=(mode='sys-check-login',password='owned-r98-theme-password')=>xml('Testtakers','<Metadata/><Group id="R98.GROUP" label="Owned Theme Group">'+groupAssets+'<Login name="r98-syscheck" pw="'+password+'" mode="'+mode+'">'+(mode==='run-hot-return'?'<Booklet>R98.BOOK</Booklet>':'')+userAssets+'<ViewSettings><theme>Sekundar</theme></ViewSettings></Login></Group>');
  const roster=body=>services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:body});
  const login=()=>services.originalSession.login({name:'r98-syscheck',password:'owned-r98-theme-password'});
  let first,second;
  await t.test('private XML credentials create a new uncoded person without admin promotion, Tests or an active release',async()=>{
   const admins=await repository.listAdminUsers();await roster(document());first=await login();
   const state=await services.originalAuthentication.read({token:first.token});assert.equal(state.kind,'person');assert.equal(state.participantSession.originalOperationalMode,'sys-check-login');assert.equal(state.participantSession.executionMode,undefined);assert.equal(state.participantSession.contentReleaseId,null);
   assert.match(state.participantSession.originalNameSuffix,/^[a-z0-9_-]{8}$/);assert.deepEqual(first.flags,[]);assert.deepEqual(first.claims,{});assert.deepEqual(await repository.listAdminUsers(),admins);assert.deepEqual(await repository.listTestRunsByParticipantSessionId(state.participantSession.participantSessionId),[]);
   const people=await repository.listParticipantSessionsByWorkspace(...ids);
   await assert.rejects(services.originalSession.login({name:'r98-syscheck',password:'owned-invalid-password'}));
   assert.deepEqual(await repository.listParticipantSessionsByWorkspace(...ids),people);
   await assert.rejects(services.originalSession.person({loginToken:first.token,code:'forbidden'}),e=>e.statusCode===403);
  });
  await t.test('current physical Syscheck metadata becomes the exact Source AccessSet without admin or test claims',async()=>{
   await uploadFile('syscheck.xml',xml('SysCheck','<Metadata><Id>R98.CHECK</Id><Label>Owned Theme Check</Label></Metadata><Config skipnetwork="true"><Q id="owned" type="string" prompt="Owned"/></Config>'));
   const actual=await services.originalSession.read({token:first.token});
   const strip=value=>{const {token,groupToken,displayName,...rest}=value;return rest;};
   assert.deepEqual(strip(actual),strip(expected));assert.match(actual.displayName,/^Owned Theme Group\/r98-syscheck\/[a-z0-9_-]{8}$/);
   assert.equal(actual.claims.workspaceAdmin,undefined);assert.equal(actual.claims.superAdmin,undefined);assert.equal(actual.claims.test,undefined);assert.equal(actual.claims.testGroupMonitor,undefined);
  });
  await t.test('another workspace cannot contribute checks and reentry creates another person while retaining earlier credentials',async()=>{
   const peer=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'peer',displayName:'Peer'});
   await services.contentIntake.uploadWorkspaceFile({tenantKey:tenant.tenantKey,workspaceKey:peer.workspaceKey,fileName:'foreign.xml',mediaType:'application/xml',sourceDocument:xml('SysCheck','<Metadata><Id>FOREIGN</Id><Label>Foreign</Label></Metadata><Config/>')});
   second=await login();assert.notEqual(second.token,first.token);assert.equal(second.groupToken,first.groupToken);assert.notEqual(second.displayName,first.displayName);assert.deepEqual(second.claims,expected.claims);assert.equal((await services.originalSession.read({token:first.token})).claims.sysCheck.length,1);
   assert.equal((await repository.listParticipantSessionsByWorkspace(...ids)).length,2);
  });
  await t.test('restart retains the exact native role, opaque credential and numeric workspace claim',async()=>{
   await close();await open();assert.deepEqual(await services.originalSession.read({token:second.token}),second);
  });
  await t.test('session reads pick up additional current physical checks without creating a Test',async()=>{
   const metadata={$schema:'https://raw.githubusercontent.com/verona-interfaces/metadata/master/verona-module-metadata.json',id:'owned-theme-player',version:'1.0.0',specVersion:'6.0',metadataVersion:'2.0',type:'player',name:[{lang:'de',value:'Owned theme Player'}]};
   await uploadFile('owned-theme-player-1.0.html','<html><script type="application/ld+json">'+JSON.stringify(metadata)+'</script></html>','text/html');
   await uploadFile('unit.xml',xml('Unit','<Metadata><Id>R98.UNIT</Id><Label>Owned</Label></Metadata><Definition player="owned-theme-player-1.0">Owned</Definition>'));
   await uploadFile('booklet.xml',xml('Booklet','<Metadata><Id>R98.BOOK</Id><Label>Owned Theme Book</Label></Metadata><Units><Unit id="R98.UNIT" label="Owned"/></Units>'));
   await uploadFile('syscheck-unit.xml',xml('SysCheck','<Metadata><Id>R99.UNITCHECK</Id><Label>Owned Unit Check</Label><Description>Owned description</Description></Metadata><Config unit="R98.UNIT" savekey="owned-key" skipnetwork="false"><CustomText key="syscheck_intro">Owned intro</CustomText><Q id="yes" type="check" prompt="Owned check" required="true"/><Q id="radio" type="radio" prompt="Owned radio">A#B</Q></Config>'));
   const actual=await services.originalSession.read({token:second.token}),observed=source.rows.find(row=>row.label==='session-after-new-check').value;
   // SessionDAO.getSysChecksOfPerson has no ORDER BY. Compare complete claims
   // by identity instead of copying this PostgreSQL plan's incidental row order.
   const ordered=value=>value.slice().sort((a,b)=>a.id.localeCompare(b.id));
   assert.deepEqual(ordered(actual.claims.sysCheck),ordered(observed.claims.sysCheck));
   assert.deepEqual(actual.access.sysCheck.slice().sort(),observed.access.sysCheck.slice().sort());
   const actor=(await services.originalAuthentication.read({token:second.token})).participantSession;
   assert.deepEqual(await repository.listTestRunsByParticipantSessionId(actor.participantSessionId),[]);
  });
  await t.test('private Systemcheck provenance authorizes current group and user assets without admin promotion',async()=>{
   const credentials={username:'owned-syscheck-asset-admin',password:'Owned syscheck asset password'};
   await services.adminAuth.bootstrapAdminUser(credentials);
   const {adminSession}=await services.adminAuth.signIn(credentials),dataBase64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=';
   const assets=[];for(const name of ['global','group','user'])assets.push(await services.originalAssets.upload({token:adminSession.token,originalName:'owned-syscheck-'+name+'.png',mediaType:'image/png',dataBase64}));
   await services.originalAssets.setAssignments({token:adminSession.token,body:{assignments:[{slotName:'logo',assetID:assets[0].id}]}});
   groupAssets='<AssetAssignments><Asset slot="logo">'+assets[1].originalName+'</Asset></AssetAssignments>';
   await roster(document());assert.equal((await services.originalAssets.getAssignments({token:second.token})).logo.assetID,assets[1].id);
   userAssets='<AssetAssignments><Asset slot="logo">'+assets[2].originalName+'</Asset></AssetAssignments>';
   await roster(document());assert.equal((await services.originalAssets.getAssignments({token:second.token})).logo.assetID,assets[2].id);
   await services.originalAssets.delete({token:adminSession.token,reference:String(assets[2].id)});
   assert.equal((await services.originalAssets.getAssignments({token:second.token})).logo.assetID,assets[1].id);
   assert.equal((await services.originalAssets.getAssignments({})).logo.assetID,assets[0].id);
   userAssets='';await roster(document());
   await assert.rejects(services.originalAssets.list({token:second.token}),e=>e.statusCode===401);
   await close();await open();assert.equal((await services.originalAssets.getAssignments({token:second.token})).logo.assetID,assets[1].id);
  });
  await t.test('a Syscheck person cannot create or own a Test or use canonical participant/admin access',async()=>{
   const actor=(await services.originalAuthentication.read({token:first.token})).participantSession;
   await assert.rejects(services.originalTest.create({token:first.token,bookletName:'R98.BOOK'}),e=>e.statusCode===403);
   await assert.rejects(services.originalTest.requireOwner({token:first.token,testNumber:'1'}),e=>e.statusCode===403);
   await assert.rejects(services.participantAccess.authorize({participantSessionId:actor.participantSessionId,sessionToken:first.token}),e=>e.statusCode===403);
   await assert.rejects(services.adminAuth.getCurrentSession({sessionToken:first.token}),e=>e.statusCode===401);
  });
  await t.test('changing a former participant to Systemcheck hides its saved Tests, Units, Reviews and command queue',async()=>{
   await roster(document('run-hot-return'));
   const testNumber=await services.originalTest.create({token:second.token,bookletName:'R98.BOOK'});
   const person=(await services.originalAuthentication.read({token:second.token})).participantSession;
   const before=await repository.listTestRunsByParticipantSessionId(person.participantSessionId);assert.equal(before.length,1);
   await roster(document());
   const expectedRuns=await repository.listTestRunsByParticipantSessionId(person.participantSessionId);
   assert.equal(expectedRuns[0].testRunId,before[0].testRunId);
   assert.equal(expectedRuns[0].executionMode,undefined);
   const request={token:second.token,testNumber},denied=e=>e.statusCode===403;
   await assert.rejects(services.originalTest.read(request),denied);
   await assert.rejects(services.originalTest.patchState({...request,patch:[]}),denied);
   await assert.rejects(services.originalTest.patchLock({...request,body:{}}),denied);
   await assert.rejects(services.originalTest.putLog({...request,body:[]}),denied);
   await assert.rejects(services.originalUnit.read({...request,unitName:'R98.UNIT'}),denied);
   await assert.rejects(services.originalUnit.putResponse({...request,unitName:'R98.UNIT',body:[]}),denied);
   await assert.rejects(services.originalReview.list({...request,unitName:null}),denied);
   await assert.rejects(services.originalReview.export({token:second.token,format:'json'}),denied);
   await assert.rejects(services.originalCommand.pending(request),denied);
   assert.deepEqual(await repository.listTestRunsByParticipantSessionId(person.participantSessionId),expectedRuns);
   assert.equal((await services.originalSession.read({token:second.token})).claims.test,undefined);
  });
  await t.test('logout revokes only its own fresh person credential',async()=>{
   await services.originalSession.logout({token:first.token});await assert.rejects(services.originalSession.read({token:first.token}),e=>e.statusCode===401);assert.equal((await services.originalSession.read({token:second.token})).loginName,'r98-syscheck');
   await assert.rejects(services.originalAssets.getAssignments({token:first.token}),e=>e.statusCode===401);
  });
  await t.test('credential replacement requires the new password for fresh login and preserves existing native person lifetime',async()=>{
   await roster(document('sys-check-login','owned-replacement-password'));
   await assert.rejects(login());
   // Native reimports retain person credentials; canonical admin password
   // revocation is a different boundary. Deletion and explicit logout above
   // still revoke native access and its scoped asset view.
   assert.equal((await services.originalSession.read({token:second.token})).token,second.token);
   assert.ok((await services.originalAssets.getAssignments({token:second.token})).logo);
   const previous=second.token;
   second=await services.originalSession.login({name:'r98-syscheck',password:'owned-replacement-password'});
   assert.equal(second.claims.sysCheck.length,2);assert.notEqual(second.token,previous);
  });
  await t.test('loss of private XML provenance invalidates native reentry and scoped assets',async()=>{
   const json={metadata:{},groups:[{id:'R98.GROUP',label:'Owned Theme Group',logins:[{name:'r98-syscheck',pw:'owned-r98-theme-password',mode:'sys-check-login'}]}]};
   await roster(json);assert.deepEqual(await repository.listOriginalOperationalLoginsByWorkspace(...ids),[]);await assert.rejects(login());await assert.rejects(services.originalSession.read({token:second.token}));
   await assert.rejects(services.originalAssets.getAssignments({token:second.token}));
   const people=await repository.listParticipantSessionsByWorkspace(...ids);
   await assert.rejects(services.participantRuntime.signIn({...scope,loginKey:'r98-syscheck',password:'owned-r98-theme-password'}),e=>e.statusCode===403);
   assert.deepEqual(await repository.listParticipantSessionsByWorkspace(...ids),people);
  });
 }finally{await close();if(pool){await pool.query('DROP SCHEMA "'+namespace+'" CASCADE');await pool.end();}await rm(dir,{recursive:true,force:true});}
});
