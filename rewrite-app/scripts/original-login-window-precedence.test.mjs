import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {Pool} from 'pg';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {compileBookletRuntimePolicy} from '@testcenter-rewrite-app/contracts';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceStorage} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
import {prepareOriginalXmlSchemaValidator} from '../packages/application/dist/packages/application/src/original-xml-schema.js';
const fixture=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-login-window-precedence/',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.json',fixture),'utf8')),source=JSON.parse(await readFile(new URL('observations.json',fixture),'utf8'));
assert.equal(manifest.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');assert.equal(manifest.actualSourceFilesUnmodified,true);assert.equal(manifest.sourceBackendHttpCaptured,false);assert.equal(manifest.testModeFixtureClock,true);assert.equal(manifest.ownedCorrectPasswordHashVerifiedWithSourcePasswordClass,true);
for(const[p,h]of Object.entries(manifest.files))assert.equal(createHash('sha256').update(await readFile(new URL(p,fixture))).digest('hex'),h);
assert.deepEqual(source.sourceHashes,manifest.sourceHashes);assert.equal(source.rows.length,6);
const validator=await prepareOriginalXmlSchemaValidator(resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE||'.data/original-xml-schemas'),process.env.FIRST_SLICE_XML_SCHEMA_DOWNLOAD!=='false');
const kinds=['memory','file','sqlite'];if(process.env.FIRST_SLICE_STORE==='postgres'){assert.ok(process.env.FIRST_SLICE_POSTGRES_URL);kinds.push('postgres');}
for(const kind of kinds)test(kind+': literal native window errors retain Source precedence without changing canonical credentials or the limiter',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'owned-native-windows-')),schema='owned_window_'+randomUUID().replaceAll('-','');let storage,pool,created=false,time=Date.parse('2026-01-01T12:00:00Z');const url=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;url?.searchParams.set('options','-c search_path='+schema);
 try{
  if(url){pool=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await pool.query(`CREATE SCHEMA "${schema}"`);created=true;}
  storage=kind==='memory'?{repository:createInMemoryFirstSliceRepository(),shutdown:async()=>{}}:kind==='file'?await createFileFirstSliceStorage(join(dir,'owned.json')):kind==='sqlite'?createSqliteFirstSliceStorage(join(dir,'owned.sqlite')):await createPostgresFirstSliceStorage(url.toString());
  const repository=storage.repository,services=createFirstSliceServices({repository,originalXmlSchemaValidator:validator,xmlSchemaProfile:'original-19',now:()=>new Date(time).toISOString()}),tenant=await services.platform.createTenant({tenantKey:'owned-'+randomUUID(),displayName:'Owned windows'}),workspace=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'owned',displayName:'Owned windows'}),ids=[tenant.tenantId,workspace.workspaceId],password='Owned correct password';
  const releaseId=randomUUID();await repository.saveContentRelease({tenantId:tenant.tenantId,workspaceId:workspace.workspaceId,contentReleaseId:releaseId,importJobId:releaseId,releaseLabel:'Owned auth prerequisite',status:'active',createdAt:new Date(time).toISOString(),activatedAt:new Date(time).toISOString(),runtimeSnapshot:{bookletEntries:[{bookletKey:'OWNED.NOT.NEEDED.FOR.REJECTED.AUTH',displayLabel:'Owned auth prerequisite',policy:compileBookletRuntimePolicy({}),testletEntries:[],unitEntries:[]}]}});
  const groups=[['expired',' validTo="1/1/2000 12:00"'],['scheduled',' validFrom="1/1/2099 12:00"'],['rate',' validTo="1/1/2026 13:01"']];
  const group=(state,window,mode='monitor-group',suffix='')=>'<Group id="OWNED.'+state.toUpperCase()+suffix+'" label="Owned '+state+'"'+window+'><Login name="owned-'+state+suffix+'" pw="'+password+'" mode="'+mode+'">'+(mode==='run-hot-return'?'<Booklet>OWNED.NOT.NEEDED.FOR.REJECTED.AUTH</Booklet>':'')+'</Login></Group>';
  const roster='<Testtakers xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/testcenter-testtaker-xml/18.0"><Metadata/>'+groups.map(([s,w])=>group(s,w)).join('')+groups.slice(0,2).map(([s,w])=>group(s,w,'run-hot-return','-canonical')).join('')+'</Testtakers>';
  await services.workspaceAdminRead.importParticipantRoster({tenantKey:tenant.tenantKey,workspaceKey:workspace.workspaceKey,rosterText:roster});
  for(const state of ['expired','scheduled'])for(const[kind,value]of [['empty',''],['wrong','Owned wrong password'],['correct',password]])await t.test(state+' with '+kind+' password matches actual Source DAO and issues no capabilities',async()=>{
   const expected=source.rows.find(r=>r.state===state&&r.passwordKind===kind);assert.ok(expected);assert.equal(expected.status,state==='expired'?410:401);
   await assert.rejects(services.originalSession.login({name:'owned-'+state,password:value}),e=>e.statusCode===expected.status&&e.errorCode===(state==='expired'?'participant_access_expired':'participant_access_not_started'));
   assert.equal(await repository.getParticipantLoginAttempt(...ids,'owned-'+state),null);assert.deepEqual(await repository.listParticipantSessionsByWorkspace(...ids),[]);
  });
  for(const state of ['expired','scheduled'])await t.test('canonical '+state+' login still rejects invalid credentials before validity',async()=>{
   await assert.rejects(services.participantRuntime.signIn({tenantKey:tenant.tenantKey,workspaceKey:workspace.workspaceKey,loginKey:'owned-'+state+'-canonical',password:'Owned wrong password'}),e=>e.statusCode===401&&e.errorCode==='participant_password_invalid');
   assert.equal((await repository.getParticipantLoginAttempt(...ids,'owned-'+state+'-canonical')).failedAttempts,1);
  });
  await t.test('actual five-failure lockout remains before a subsequently expired native window',async()=>{
   for(let n=0;n<5;n++)await assert.rejects(services.originalSession.login({name:'owned-rate',password:'Owned wrong password'}),e=>e.statusCode===401&&e.errorCode==='participant_password_invalid');
   assert.equal((await repository.getParticipantLoginAttempt(...ids,'owned-rate')).failedAttempts,5);time+=120_000;
   for(const value of [password,'Owned wrong password',''])await assert.rejects(services.originalSession.login({name:'owned-rate',password:value}),e=>e.statusCode===429&&e.errorCode==='participant_login_rate_limited');
   assert.deepEqual(await repository.listParticipantSessionsByWorkspace(...ids),[]);
  });
 }finally{await storage?.shutdown();if(created)await pool.query(`DROP SCHEMA "${schema}" CASCADE`);await pool?.end();await rm(dir,{recursive:true,force:true});}
});
