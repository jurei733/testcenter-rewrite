import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import test from 'node:test';
import {Pool} from 'pg';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceStorage} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
import {prepareOriginalXmlSchemaValidator} from '../packages/application/dist/packages/application/src/original-xml-schema.js';
import {createProductionApiServer} from '../apps/api/dist/apps/api/src/index.js';
const source=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-monitor-frontend-support/',import.meta.url);
const validator=await prepareOriginalXmlSchemaValidator(resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE||'.data/original-xml-schemas'),process.env.FIRST_SLICE_XML_SCHEMA_DOWNLOAD!=='false');
const password='Owned frontend native password',monitorName='owned-frontend-monitor',studyName='owned-frontend-study',personName='owned-frontend-one',group='ORACLE.FRONTEND';
const xml=(type,body)=>`<${type} xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/${type==='Unit'?'unit-xml/17.6':type==='Booklet'?'testcenter-booklet-xml/18.0':'testcenter-testtaker-xml/18.0'}">${body}</${type}>`;
const profile=label=>`<Profile id="007" label=" ${label} Ω " blockColumn="hide" unitColumn="show" groupColumn="show" bookletColumn="hide" view="small" bookletStatesColumns=" A, B " filterPending="yes" filterLocked="no" autoselectNextBlock="no"><Filter field="personLabel" type="substring" value=" A &amp; B " subValue=" X " label=" Raw filter " not="true"/><Filter field="mode" type="equal" value="run-trial" not="1"/></Profile>`;
const roster=(label='Initial',mode='monitor-group')=>xml('Testtakers','<Metadata/><Profiles><GroupMonitor><Profile id="empty"><Filter/></Profile>'+profile(label)+'<Profile id="unassigned" label="Private other profile"/></GroupMonitor></Profiles>'+`<Group id="${group}" label="Owned frontend"><Login name="${monitorName}" pw="${password}" mode="${mode}"><Profile id="empty"/><Profile id="007"/></Login><Login name="${studyName}" pw="${password}" mode="monitor-study"/><Login name="${personName}" pw="${password}" mode="run-hot-return"><Booklet codes="Shared">ORACLE.POW.BOOK#OWNED:PRESET</Booklet></Login></Group>`);
const denied=status=>error=>error.statusCode===status;
const receipt=JSON.parse(await readFile(new URL('receipt.json',source),'utf8'));

test('Source91 retains every Source79 control and proves native frontend support plus explicit scope defects',async()=>{
 const manifest=JSON.parse(await readFile(new URL('manifest.json',source),'utf8'));
 assert.equal(manifest.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');
 assert.equal(manifest.checks,91);assert.equal(manifest.precedingChecksRetained,79);
 assert.equal(receipt.success,true);assert.equal(receipt.checks.length,91);assert.equal(receipt.testMode,false);
 for(const[name,sha]of Object.entries(manifest.files)){assert.match(name,/^[a-z0-9][a-z0-9.-]*$/);assert.equal(createHash('sha256').update(await readFile(new URL(name,source))).digest('hex'),sha,name);}
 const previous=JSON.parse(await readFile(new URL('../native-monitor-materialization/receipt.json',source),'utf8'));
 assert.deepEqual(receipt.checks.slice(0,79).map(row=>row.name),previous.checks.map(row=>row.name));
 assert.equal(receipt.checks[81].unassignedPersonStatus,200);assert.deepEqual(receipt.checks[81].variants.map(row=>row.status),[200,404,404]);
 assert.equal(receipt.checks[83].aliasStatus,200);assert.equal(receipt.checks[84].profile.label,' Changed Ω ');
 assert.equal(receipt.checks[88].status,400);assert.equal(receipt.checks[89].status,200);assert.equal(receipt.checks[90].status,200);
});

for(const kind of process.env.FIRST_SLICE_STORE==='postgres'?['postgres']:['memory','file','sqlite'])test(`${kind}: literal attached profiles and authorized physical Booklet XML survive imports and restart`,async t=>{
 const directory=await mkdtemp(join(tmpdir(),'owned-native-monitor-frontend-')),file=join(directory,kind==='file'?'state.json':'state.sqlite');
 const schema='owned_monitor_frontend_'+randomUUID().replaceAll('-',''),url=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;
 url?.searchParams.set('options','-c search_path='+schema);
 let storage,repository,services,pool,server,scope,ids,monitor,study,owner,login;
 const open=async()=>{storage=kind==='memory'?storage??{repository:createInMemoryFirstSliceRepository(),shutdown:async()=>{}}:kind==='file'?await createFileFirstSliceStorage(file):kind==='sqlite'?createSqliteFirstSliceStorage(file):await createPostgresFirstSliceStorage(url.toString());repository=storage.repository;services=createFirstSliceServices({repository,originalXmlSchemaValidator:validator,xmlSchemaProfile:'original-19'});};
 const read=(profileId='007',token=monitor.token)=>services.originalMonitor.profile({token,profileId});
 const booklet=(bookletName='ORACLE.POW.BOOK',token=monitor.token)=>services.originalMonitor.booklet({token,bookletName});
 const shutdown=async()=>{if(server){await new Promise((done,reject)=>server.close(error=>error?reject(error):done()));server=undefined;}await storage?.shutdown();};
 try{
  if(url){pool=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await pool.query(`CREATE SCHEMA "${schema}"`);}await open();
  const tenant=await services.platform.createTenant({tenantKey:'owned-'+randomUUID(),displayName:'Owned frontend native'}),workspace=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'owned',displayName:'Owned frontend native'});
  scope={tenantKey:tenant.tenantKey,workspaceKey:workspace.workspaceKey};ids=[tenant.tenantId,workspace.workspaceId];
  const upload=(fileName,sourceDocument,mediaType='application/xml')=>services.contentIntake.uploadWorkspaceFile({...scope,fileName,sourceDocument,mediaType});
  await upload('player.html','<html><script type="application/ld+json">'+JSON.stringify({id:'owned-frontend-player',version:'1.2.3',specVersion:'6.0',metadataVersion:'2.0',type:'player',name:[{lang:'de',value:'Owned Player'}]})+'</script><main>Owned</main></html>','text/html');
  await upload('unit.xml',xml('Unit','<Metadata><Id>ORACLE.POW.UNIT</Id><Label>Owned Unit</Label></Metadata><Definition player="owned-frontend-player@1.2.3">Owned</Definition>'));
  const book=xml('Booklet','<Metadata><Id>ORACLE.POW.BOOK</Id><Label>Owned Ω Booklet</Label></Metadata><Units><Unit id="ORACLE.POW.UNIT" label="Owned Unit"/></Units>');
  await upload('booklet.xml',book);
  await upload('unassigned.xml',book.replaceAll('ORACLE.POW.BOOK','ORACLE.FRONTEND.UNASSIGNED'));
  const importRoster=(label,mode)=>services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:roster(label,mode)});
  await importRoster();monitor=await services.originalSession.login({name:monitorName,password});study=await services.originalSession.login({name:studyName,password});
  login=await services.originalAuthentication.login({name:personName,password});owner=await services.originalAuthentication.person({loginToken:login.token,code:'Shared'});
  await t.test('literal native profiles exactly match measured Source while canonical import normalization retains its existing contract',async()=>{
   assert.deepEqual(await read('empty'),receipt.checks[82].profile);assert.deepEqual(await read(),receipt.checks[83].profile);assert.deepEqual(await read('7'),await read());
   const claims=monitor.claims.testGroupMonitor;assert.equal(claims.find(row=>row.flags.profile==='007').flags.subLabel,' Initial Ω ');
   const candidates=await repository.listOperationalLoginMigrationCandidatesByWorkspace(...ids),candidate=candidates.find(row=>row.loginKey===monitorName);
   assert.equal(candidate.monitorProfiles[0].settings.blockColumn,'show');assert.equal(candidate.monitorProfiles[1].label,'Initial Ω');assert.equal(candidate.monitorProfiles[1].filters[1].not,true);
   assert.equal(JSON.stringify(candidates).includes('originalMonitorProfiles'),false);assert.equal(JSON.stringify(candidates).includes('passwordHash'),false);
   const mutable=await read();mutable.filters[0].value='Changed by caller';mutable.settings.view='bad';assert.deepEqual(await read(),receipt.checks[83].profile);
  });
  await t.test('profile access requires native monitor role and attachment, and same bearer reads current reimported XML',async()=>{
   await assert.rejects(read('unassigned'),denied(404));await assert.rejects(read('empty',study.token),denied(404));
   await assert.rejects(read('empty',owner.token),denied(403));await assert.rejects(read('empty',login.token),denied(403));
   await importRoster('Changed');assert.deepEqual(await read(),receipt.checks[84].profile);assert.deepEqual(await read('empty'),receipt.checks[82].profile);
   const access=await services.originalSession.read({token:monitor.token});assert.equal(access.claims.testGroupMonitor.find(row=>row.flags.profile==='007').flags.subLabel,' Changed Ω ');
  });
  await t.test('current physical XML is scoped to native monitor or person assignments and does not open any Test',async()=>{
   const before=await repository.listOriginalPersonTestIdentities(owner.participantSession);
   assert.equal(await booklet(),book);assert.equal(await booklet('oracle.pow.book',owner.token),book);assert.equal(await booklet('ORACLE.POW.BOOK',study.token),book);
   assert.equal(await booklet('ORACLE.FRONTEND.UNASSIGNED'),book.replaceAll('ORACLE.POW.BOOK','ORACLE.FRONTEND.UNASSIGNED'));
   await assert.rejects(booklet('ORACLE.FRONTEND.UNASSIGNED',owner.token),denied(403));await assert.rejects(booklet('ORACLE.POW.BOOK',login.token),denied(403));
   await assert.rejects(booklet('ORACLE.POW.BOOK#OWNED:PRESET'),denied(404));await assert.rejects(booklet('MISSING'),denied(404));
   assert.deepEqual(await repository.listOriginalPersonTestIdentities(owner.participantSession),before);
   const changed=book.replace('Owned Ω Booklet','Current Ω XML');await upload('booklet.xml',changed);assert.equal(await booklet(),changed);
   const peer=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'foreign',displayName:'Owned foreign'});
   const foreignUpload=(fileName,sourceDocument,mediaType='application/xml')=>services.contentIntake.uploadWorkspaceFile({tenantKey:tenant.tenantKey,workspaceKey:peer.workspaceKey,fileName,mediaType,sourceDocument});
   await foreignUpload('foreign-player.html','<html><script type="application/ld+json">'+JSON.stringify({id:'owned-frontend-player',version:'1.2.3',specVersion:'6.0',metadataVersion:'2.0',type:'player',name:[{lang:'de',value:'Owned foreign Player'}]})+'</script><main>Owned foreign</main></html>','text/html');
   await foreignUpload('foreign-unit.xml',xml('Unit','<Metadata><Id>ORACLE.POW.UNIT</Id><Label>Owned foreign Unit</Label></Metadata><Definition player="owned-frontend-player@1.2.3">Owned foreign</Definition>'));
   await foreignUpload('foreign.xml',book.replaceAll('ORACLE.POW.BOOK','ORACLE.ONLY.FOREIGN'));
   await assert.rejects(booklet('ORACLE.ONLY.FOREIGN'),denied(404));
  });
  await t.test('fresh monitor and study logins after a role regrant cannot demote operational people through historical roster entries',async()=>{
   await importRoster('Changed','run-hot-return');
   await assert.rejects(services.originalMonitor.sessions({token:monitor.token,groupKey:group}),denied(403));
   await importRoster('Changed');
   const fresh=await services.originalSession.login({name:monitorName,password});
   assert.ok(Array.isArray(JSON.parse(await services.originalMonitor.sessions({token:fresh.token,groupKey:group}))));
   const actor=(await services.originalAuthentication.read({token:fresh.token})).participantSession;
   assert.equal((await repository.getParticipantSessionById(actor.participantSessionId)).originalOperationalMode,'monitor-group');
   study=await services.originalSession.login({name:studyName,password});
   monitor=fresh; // Successful reauthentication rotates the old credential.
   assert.ok(Array.isArray(JSON.parse(await services.originalMonitor.sessions({token:fresh.token,groupKey:group}))));
   assert.equal((await repository.getParticipantSessionById(actor.participantSessionId)).originalOperationalMode,'monitor-group');
  });
  await t.test('unknown legacy raw profile history fails closed and validated reimport restores it without invented defaults',async()=>{
   const candidates=await repository.listOperationalLoginMigrationCandidatesByWorkspace(...ids),privateRows=await repository.listOriginalOperationalLoginsByWorkspace(...ids);
   await repository.replaceOperationalLoginMigrationCandidatesByWorkspace(...ids,candidates,privateRows.map(({originalMonitorProfiles,...row})=>row));
   await assert.rejects(read(),denied(409));await importRoster('Changed');assert.deepEqual(await read(),receipt.checks[84].profile);
   const before=await repository.listOriginalOperationalLoginsByWorkspace(...ids);await assert.rejects(repository.replaceOperationalLoginMigrationCandidatesByWorkspace(...ids,candidates,before.map(row=>row.loginKey===monitorName?{...row,originalMonitorProfiles:[{id:'bad'}]}:row)),TypeError);
   assert.deepEqual(await repository.listOriginalOperationalLoginsByWorkspace(...ids),before);
  });
  await t.test('real store restart preserves raw authored strings, exact attachment order and existing native bearer',async()=>{
   if(kind!=='memory'){await storage.shutdown();await open();}assert.deepEqual(await read(),receipt.checks[84].profile);assert.deepEqual(await read('empty'),receipt.checks[82].profile);
   assert.equal((await services.originalSession.read({token:monitor.token})).token,monitor.token);
  });
  if(kind==='sqlite'||kind==='postgres')await t.test('production HTTP uses actual configured proof of work, AuthToken, XML content type and predecode role checks',async()=>{
   const env={FIRST_SLICE_STORE:kind,FIRST_SLICE_SQLITE_FILE:file,FIRST_SLICE_BOOTSTRAP_DEMO:'false',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_XML_SCHEMA_PROFILE:'original-19',REQUIRE_LOGIN_PASSWORD:'false',FIRST_SLICE_PROOF_OF_WORK_SCOPES:'participant,second_code',FIRST_SLICE_PROOF_OF_WORK_SECRET:'owned-frontend-http-challenge-secret-not-production',FIRST_SLICE_PROOF_OF_WORK_PREVIOUS_SECRET:'',FIRST_SLICE_PROOF_OF_WORK_MAX_NUMBER:'12',...(url?{FIRST_SLICE_POSTGRES_URL:url.toString()}:{})};const previous=new Map(Object.keys(env).map(key=>[key,process.env[key]]));
   try{Object.assign(process.env,env);server=await createProductionApiServer();}finally{for(const[key,value]of previous)if(value===undefined)delete process.env[key];else process.env[key]=value;}
   await new Promise(done=>server.listen(0,'127.0.0.1',done));const base='http://127.0.0.1:'+server.address().port;
   const request=async(method,path,{token,body,status=200,headers={}}={})=>{const response=await fetch(base+path,{method,headers:{...headers,...(token?{AuthToken:token}:{}),...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});const text=await response.text();assert.equal(response.status,status,method+' '+path+': '+text);assert.equal(response.headers.get('cache-control'),'private, no-store');return{response,text};};
   await request('PUT','/session/login',{body:{name:monitorName,password},status:400});
   const challenge=JSON.parse((await request('POST','/session/challenge',{body:{loginType:'login',name:monitorName,password}})).text);let solution;
   for(let number=0;number<=challenge.maxNumber;number++)if(createHash('sha256').update(challenge.salt+number).digest('hex')===challenge.challenge){solution={algorithm:challenge.algorithm,salt:challenge.salt,signature:challenge.signature,challenge:challenge.challenge,number};break;}assert.ok(solution);
   const access=JSON.parse((await request('PUT','/session',{body:solution})).text),profilePath='/monitor/profile/007';monitor=access;
   const result=await request('GET',profilePath,{token:access.token});assert.equal(result.response.headers.get('content-type'),'application/json');assert.deepEqual(JSON.parse(result.text),receipt.checks[84].profile);
   const bookResult=await request('GET','/booklet/oracle.pow.book',{token:access.token});assert.equal(bookResult.response.headers.get('content-type'),'application/xml');assert.equal(bookResult.text,await booklet());
   await request('GET',profilePath,{status:401});await request('GET',profilePath,{headers:{authorization:'Bearer '+access.token},status:401});
   for(const path of ['/monitor/profile/%ZZ','/booklet/%ZZ']){await request('GET',path,{status:401});await request('GET',path,{token:login.token,status:403});await request('GET',path,{token:access.token,status:400});}
   await request('GET','/monitor/profile/%ZZ',{token:owner.token,status:403});
   const deniedResult=await request('GET','/booklet/ORACLE.FRONTEND.UNASSIGNED',{token:owner.token,status:403});assert.equal(deniedResult.text.includes(owner.token),false);assert.equal(deniedResult.response.headers.get('test-mode'),'NO');
   await request('GET','/monitor/profile/unassigned',{token:access.token,status:404});
   const method=await request('POST',profilePath,{token:access.token,status:405});assert.equal(method.response.headers.get('allow'),'GET');
   await new Promise((done,reject)=>server.close(error=>error?reject(error):done()));server=undefined;
  });
  await t.test('removing private provenance denies all former native monitor capabilities',async()=>{
   const candidates=await repository.listOperationalLoginMigrationCandidatesByWorkspace(...ids);await repository.replaceOperationalLoginMigrationCandidatesByWorkspace(...ids,candidates);
   await assert.rejects(read(),denied(410));await assert.rejects(booklet(),denied(410));
  });
 }finally{await shutdown();if(pool){await pool.query(`DROP SCHEMA "${schema}" CASCADE`);await pool.end();}await rm(directory,{recursive:true,force:true});}
});
