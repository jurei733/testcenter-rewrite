import {verifyNativeAdminGrantLocks} from './native-admin-grant-lock-controls.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Pool,types as pgTypes} from 'pg';
import {DatabaseSync} from 'node:sqlite';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceStorage} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
import {createProductionApiServer} from '../apps/api/dist/apps/api/src/index.js';
const oracle=JSON.parse(await readFile(new URL('../test-fixtures/original-testcenter/source-workspace-results/native-admin-session-http/observations.json',import.meta.url),'utf8')).rows;
const source=label=>oracle.find(r=>r.label===label);
const password='Owned-native-directory-password-2026!',changed=password+'new';
const code=expected=>error=>error.errorCode===expected;
const kinds=['memory','file','sqlite',...(process.env.FIRST_SLICE_STORE==='postgres'?['postgres']:[])];
const ordered=rows=>rows.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));

for(const kind of kinds)test(`${kind}: native directory, exact creation and password transition retain Source metadata and durable guards`,async t=>{
 const dir=await mkdtemp(join(tmpdir(),'owned-native-directory-')),file=join(dir,kind==='file'?'state.json':'state.sqlite');
 const schema='owned_directory_'+randomUUID().replaceAll('-',''),url=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;
 url?.searchParams.set('options','-c search_path='+schema);url?.searchParams.set('application_name',schema);
 let pool,created=false,storage,repository,services,root,regular,peer,tenant,workspace,token;
 const now=()=>new Date().toISOString();
 const open=async()=>{storage=kind==='memory'?storage??{repository:createInMemoryFirstSliceRepository(),shutdown:async()=>{}}:kind==='file'?await createFileFirstSliceStorage(file):kind==='sqlite'?createSqliteFirstSliceStorage(file):await createPostgresFirstSliceStorage(url.toString());repository=storage.repository;services=createFirstSliceServices({repository,now,participantAccessTimeZone:'Europe/Berlin'});};
 const reopen=async()=>{if(kind!=='memory'){await storage.shutdown();storage=undefined;}await open();};
 try{
  if(url){pool=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await pool.query(`CREATE SCHEMA "${schema}"`);created=true;}await open();
  await services.adminAuth.bootstrapAdminUser({username:'super',password});root=await services.originalAdminSession.login({name:'super',password});
  await t.test('native user creation preserves spelling and numeric IDs; both directories match real Source DTOs and order',async()=>{
   for(const[name,id]of [['OwnedÄdmin','2'],['NoWorkspaces','3'],['RateOwned','4'],['R58Observer','5']])assert.equal(await services.originalAdminDirectory.createUser({token:root.token,name,password}),id);
   regular=await services.originalAdminSession.login({name:'ownedädmin',password});peer=await services.originalAdminSession.login({name:'NoWorkspaces',password});token=regular.token;
   assert.equal(regular.loginName,'OwnedÄdmin');assert.equal(regular.pwSetByAdmin,true);
   assert.deepEqual(JSON.parse(await services.originalAdminDirectory.listUsers({token:root.token})),source('root-users').value);
   tenant=await services.platform.createTenant({tenantKey:'owned-directory',displayName:'Owned directory'});
   workspace=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'zulu',displayName:'Zulu Ω'});
   await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'alpha',displayName:'Alpha Ä'});
   assert.deepEqual(JSON.parse(await services.originalAdminDirectory.listWorkspaces({token:root.token})),source('root-workspaces').value);
   await assert.rejects(services.originalAdminDirectory.createUser({token:root.token,name:'OWNEDÄDMIN',password}),code('original_admin_name_conflict'));
  });
  await t.test('regular capabilities cannot project directory or another actor password metadata',async()=>{
   await assert.rejects(services.originalAdminDirectory.listUsers({token}),code('original_super_admin_required'));
   await assert.rejects(services.originalAdminDirectory.listWorkspaces({token}),code('original_super_admin_required'));
   await repository.mutateOriginalAdminSession({token,at:now(),directory:'users',targetAdminNumber:'1'},s=>{assert.equal(s.directory,undefined);assert.equal(s.target,undefined);return{};});
   await assert.rejects(services.originalAdminSession.changePassword({token,adminNumber:'1',password:changed,oldPassword:password}),code('original_admin_not_self'));
   const actor=await repository.getAdminUserByUsername('super');await repository.saveAdminUser({...actor,status:'disabled'});
   await assert.rejects(services.originalAdminDirectory.listUsers({token:root.token}),code('original_admin_session_invalid'));await repository.saveAdminUser(actor);
  });
  await t.test('workspace modification projects only current physical files, not assembled archives, replaced files or private payloads',async()=>{
   const scope={tenantId:workspace.tenantId,workspaceId:workspace.workspaceId},marker='OWNED_UNRELATED_PRIVATE_DIRECTORY_PAYLOAD';
   const packageRow=(id,uploadedAt)=>({...scope,sourcePackageId:id,fileName:id+'.xml',mediaType:'application/xml',contentStructure:{bookletEntries:[],privateFixtureMarker:marker},sourceDocument:marker,status:'accepted',uploadedAt});
   await repository.saveSourcePackage(packageRow('old','2026-10-31T20:10:00.000Z'));
   await repository.saveSourcePackage(packageRow('current','2026-10-30T12:30:00.000Z'));
   await repository.saveSourcePackage(packageRow('generated','2026-11-02T20:30:00.000Z'));
   const event=(eventType,subjectId,details)=>({...scope,activityEventId:randomUUID(),eventType,actorId:null,subjectType:'source_package',subjectId,occurredAt:now(),summary:'Owned directory metadata control',details});
   await repository.saveWorkspaceActivityEvent(event('source_package_replaced','old',{replacementSourcePackageId:'current'}));
   await repository.saveWorkspaceActivityEvent(event('source_package_assembled','generated',{}));
   const originalParse=JSON.parse,originalPg=pgTypes.getTypeParser(3802);
   const guard=text=>{if(typeof text==='string'&&text.includes(marker))throw Error('Owned private content decoder fence');return originalParse(text);};
   JSON.parse=guard;if(kind==='postgres')pgTypes.setTypeParser(3802,guard);
   try{
    if(kind==='sqlite'||kind==='postgres')await assert.rejects(repository.getSourcePackageById('current'),/decoder fence/);
    const rows=JSON.parse(await services.originalAdminDirectory.listWorkspaces({token:root.token}));
    assert.equal(rows.find(r=>r.id===1).latest_modification_ts,'2026-10-30 13:30:00');assert.equal(rows.find(r=>r.id===2).latest_modification_ts,null);
   }finally{JSON.parse=originalParse;if(kind==='postgres')pgTypes.setTypeParser(3802,originalPg);}
  });
  await t.test('canonical/native concurrent creation cannot produce collation aliases or consume a failed identity',async()=>{
   const results=await Promise.allSettled([services.originalAdminDirectory.createUser({token:root.token,name:'ConcurrentÄ',password}),services.adminDirectory.createAdminUser({sessionToken:root.token,username:'CONCURRENTÄ',password})]);
   assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.statusCode,409);
   assert.equal(JSON.parse(await services.originalAdminDirectory.listUsers({token:root.token})).filter(r=>r.name.toLowerCase()==='concurrentä').length,1);
  });
  await t.test('self password checks old credentials even when forced; one fresh capability replaces every old admin token',async()=>{
   await assert.rejects(services.originalAdminSession.changePassword({token,adminNumber:'2',password:changed}),code('original_old_password_required'));
   await assert.rejects(services.originalAdminSession.changePassword({token,adminNumber:'2',password:changed,oldPassword:'wrong'}),code('original_old_password_invalid'));
   await assert.rejects(services.originalAdminSession.changePassword({token,adminNumber:'2',password:'bad',oldPassword:password}),code('admin_password_policy_violation'));
   const user=await repository.getAdminUserById((await repository.getAdminSessionByToken(token)).adminUserId);
   await repository.saveAdminRoleAssignment({roleAssignmentId:randomUUID(),adminUserId:user.adminUserId,role:'workspace_admin',accessMode:'read_only',tenantId:workspace.tenantId,workspaceId:workspace.workspaceId,groupKey:null,monitorProfiles:[],monitorBookletVisibility:'visible',createdAt:now()});
   const old=token,fresh=await services.originalAdminSession.changePassword({token,adminNumber:'2',password:changed,oldPassword:password});token=fresh.token;
   assert.notEqual(token,old);assert.equal(fresh.pwSetByAdmin,false);assert.equal(fresh.id,'2');assert.deepEqual(fresh.access.workspaceAdmin,['1']);
   await assert.rejects(services.originalAdminSession.read({token:old}),code('original_admin_session_invalid'));
   assert.equal((await services.originalWorkspaceAdministration.resolve({token,workspacePathSegment:'1',write:false})).workspaceId,workspace.workspaceId);
   assert.equal((await services.originalAdminSession.read({token:peer.token})).id,'3');await reopen();assert.equal((await services.originalAdminSession.read({token})).id,'2');
  });
  await t.test('late audit collision rolls password, session replacement and numeric state back through durable reopen',async()=>{
   const userId=(await repository.getAdminSessionByToken(token)).adminUserId,before=await repository.getAdminUserById(userId),sessions=ordered(await repository.listAdminSessions()),audit=ordered(await repository.listAdminAuditEvents());
   const collision=audit[0].adminAuditEventId,fault=createFirstSliceServices({repository,now,idGenerator:()=>collision});
   await assert.rejects(fault.originalAdminSession.changePassword({token,adminNumber:'2',password:changed+'failed',oldPassword:changed}),/collision|unique|duplicate/i);
   await reopen();assert.deepEqual(await repository.getAdminUserById(userId),before);assert.deepEqual(ordered(await repository.listAdminSessions()),sessions);assert.deepEqual(ordered(await repository.listAdminAuditEvents()),audit);assert.equal((await services.originalAdminSession.read({token})).id,'2');
  });
  await t.test('simultaneous password changes recheck the hash inside the writer boundary',async()=>{
   const results=await Promise.allSettled([services.originalAdminSession.changePassword({token,adminNumber:'2',password:changed+'A',oldPassword:changed}),services.originalAdminSession.changePassword({token,adminNumber:'2',password:changed+'B',oldPassword:changed})]);
   assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
   token=results.find(r=>r.status==='fulfilled').value.token;assert.equal((await services.originalAdminSession.read({token})).id,'2');
   const actorId=(await repository.getAdminSessionByToken(token)).adminUserId;assert.equal((await repository.listAdminSessions()).filter(s=>s.adminUserId===actorId&&s.revokedAt===null).length,1);
  });
  await t.test('super reset revokes the target only and requires the regular user to change again',async()=>{
   assert.equal(await services.originalAdminSession.changePassword({token:root.token,adminNumber:'2',password:changed+'reset'}),undefined);
   await assert.rejects(services.originalAdminSession.read({token}),code('original_admin_session_invalid'));
   const reset=await services.originalAdminSession.login({name:'OwnedÄdmin',password:changed+'reset'});assert.equal(reset.pwSetByAdmin,true);
   await assert.rejects(services.originalWorkspaceAdministration.resolve({token:reset.token,workspacePathSegment:'1',write:false}),code('admin_password_change_required'));
   assert.equal((await services.originalAdminSession.read({token:root.token})).id,'1');assert.equal((await services.originalAdminSession.read({token:peer.token})).id,'3');
  });
  await t.test('native directory and password paths retain exact high IDs across reopen',async()=>{
   await repository.mutateOriginalAdminSession({token:root.token},()=>({counter:'9007199254740992'}));
   const id=await services.originalAdminDirectory.createUser({token:root.token,name:'OwnedHighDirectory',password});assert.equal(id,'9007199254740993');await reopen();
   const raw=await services.originalAdminDirectory.listUsers({token:root.token});assert.match(raw,/"id":9007199254740993,/);
   const high=await services.originalAdminSession.login({name:'OwnedHighDirectory',password}),fresh=await services.originalAdminSession.changePassword({token:high.token,adminNumber:id,password:changed,oldPassword:password});
   assert.equal(fresh.id,id);await reopen();assert.equal((await services.originalAdminSession.read({token:fresh.token})).id,id);
  });
  if(url)await verifyNativeAdminGrantLocks(t,{repository,services,root,password,connectionString:url.toString()});
 }finally{await storage?.shutdown();if(created)await pool.query(`DROP SCHEMA "${schema}" CASCADE`);await pool?.end();await rm(dir,{recursive:true,force:true});}
});

test(`real ${process.env.FIRST_SLICE_STORE==='postgres'?'PostgreSQL':'SQLite'} native administration HTTP preserves Source DTOs and password-confirmed token transition`,async t=>{
 const dir=await mkdtemp(join(tmpdir(),'owned-directory-http-')),file=join(dir,'owned.sqlite'),postgres=process.env.FIRST_SLICE_STORE==='postgres';
 const schema='owned_directory_api_'+randomUUID().replaceAll('-',''),url=postgres?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;
 url?.searchParams.set('options','-c search_path='+schema);url?.searchParams.set('application_name',schema);
 const environment={FIRST_SLICE_STORE:postgres?'postgres':'sqlite',FIRST_SLICE_SQLITE_FILE:file,FIRST_SLICE_BOOTSTRAP_DEMO:'false',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_PROOF_OF_WORK_SCOPES:'participant,second_code',FIRST_SLICE_PROOF_OF_WORK_SECRET:'Owned-directory-HTTP-challenge-secret-2026',FIRST_SLICE_PROOF_OF_WORK_PREVIOUS_SECRET:'',FIRST_SLICE_PROOF_OF_WORK_MAX_NUMBER:'12',FIRST_SLICE_PROOF_OF_WORK_TTL_MS:'60000',...(url?{FIRST_SLICE_POSTGRES_URL:url.toString()}:{})};
 const previous=new Map(Object.keys(environment).map(key=>[key,process.env[key]]));let pool,storage,server,base,created=false,rootToken,regularToken;
 const request=async(method,path,body,token,rawBody)=>{
  const r=await fetch(base+path,{method,headers:{...(body!==undefined||rawBody!==undefined?{'content-type':'application/json'}:{}),...(token===undefined?{}:{AuthToken:token})},...(rawBody!==undefined?{body:rawBody}:body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
  const text=await r.text();return{status:r.status,text,headers:r.headers,value:r.headers.get('content-type')?.includes('application/json')?JSON.parse(text):text};
 };
 try{
  if(postgres){pool=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await pool.query(`CREATE SCHEMA "${schema}"`);created=true;}
  try{Object.assign(process.env,environment);server=await createProductionApiServer();}finally{for(const[key,value]of previous)if(value===undefined)delete process.env[key];else process.env[key]=value;}
  storage=postgres?await createPostgresFirstSliceStorage(url.toString()):createSqliteFirstSliceStorage(file);
  const services=createFirstSliceServices({repository:storage.repository});await services.adminAuth.bootstrapAdminUser({username:'super',password});
  await new Promise(done=>server.listen(0,'127.0.0.1',done));base='http://127.0.0.1:'+server.address().port;
  rootToken=(await request('PUT','/session/admin',{name:'super',password})).value.token;
  await t.test('actual native creation, case-preserved login and directory bytes match Source',async()=>{
   for(const[name,id]of [['OwnedÄdmin','2'],['NoWorkspaces','3'],['RateOwned','4'],['R58Observer','5']]){const r=await request('PUT','/user',{n:name,p:password},rootToken);assert.equal(r.status,201);assert.equal(r.text,id);}
   const users=await request('GET','/users',undefined,rootToken);assert.equal(users.status,200);assert.deepEqual(users.value,source('root-users').value);assert.equal(users.headers.get('cache-control'),'private, no-store');
   assert.equal((await request('GET','/workspaces',undefined,rootToken)).text,'[]');
   const regular=await request('PUT','/session/admin',{name:'ownedädmin',password});assert.equal(regular.status,200);assert.equal(regular.value.loginName,'OwnedÄdmin');regularToken=regular.value.token;
   const conflict=await request('PUT','/user',{n:'OWNEDÄDMIN',p:password},rootToken);assert.equal(conflict.status,409);
   for(const path of ['/users','/workspaces']){const r=await request('GET',path,undefined,regularToken);assert.equal(r.status,403);assert.equal(r.text,source('regular-users-denied').value);}
  });
  await t.test('authentication precedes mutation bodies; empty/missing/null fields and self-password errors retain Source semantics',async()=>{
   assert.equal((await request('PUT','/user',undefined,undefined,'{')).status,401);
   assert.equal((await request('PUT','/user',undefined,regularToken,'{')).status,403);
   for(const body of [undefined,{}, {n:null,p:password},{n:'x'}]){const r=await request('PUT','/user',body,rootToken);assert.equal(r.status,400);assert.equal(r.text,'Username or Password missing');}
   assert.equal((await request('PUT','/user',{n:42,p:password},rootToken)).status,500);
   assert.equal((await request('PATCH','/user/2/password',undefined,regularToken)).text,'Password missing');
   for(const oldPassword of [undefined,null]){const r=await request('PATCH','/user/2/password',{p:changed,...oldPassword===undefined?{}:{oldPassword}},regularToken);assert.equal(r.status,400);assert.equal(r.text,source('self-password-missing-old').value);}
   assert.equal((await request('PATCH','/user/2/password',{p:42},regularToken)).status,400);
   assert.equal((await request('PATCH','/user/2/password',{p:42,oldPassword:'wrong'},regularToken)).status,403);
   assert.equal((await request('PATCH','/user/2/password',{p:42,oldPassword:password},regularToken)).status,500);
   const wrong=await request('PATCH','/user/2/password',{p:changed,oldPassword:'wrong'},regularToken);assert.equal(wrong.status,403);assert.equal(wrong.text,source('self-password-wrong-old').value);
   assert.equal((await request('PATCH','/user/1/password',{p:changed,oldPassword:password},regularToken)).status,500);
  });
  await t.test('successful self password PATCH has empty200 body and a fresh readable AuthToken; old token is forbidden',async()=>{
   const old=regularToken,r=await request('PATCH','/user/2/password',{p:changed,oldPassword:password},regularToken);assert.equal(r.status,200);assert.equal(r.text,'');regularToken=r.headers.get('authtoken');assert.ok(regularToken);assert.notEqual(regularToken,old);
   const fresh=await request('GET','/session',undefined,regularToken);assert.equal(fresh.status,200);assert.equal(fresh.value.id,2);assert.equal(fresh.value.pwSetByAdmin,false);
   const retired=await request('GET','/session',undefined,old);assert.equal(retired.status,403);assert.equal(retired.text,'Invalid token.');assert.equal(retired.text.includes(old),false);
  });
  await t.test('actual HTTP audit failure returns a redacted Source500 and leaves the old password/session valid',async()=>{
   const control=postgres?new Pool({connectionString:url.toString()}):new DatabaseSync(file);
   const exec=sql=>postgres?control.query(sql):Promise.resolve(control.exec(sql));
   try{
    await exec(postgres?`CREATE FUNCTION owned_directory_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned directory audit failure'; END $$; CREATE TRIGGER owned_directory_audit_failure BEFORE INSERT ON admin_audit_events FOR EACH ROW WHEN (NEW.event_type='admin_password_changed') EXECUTE FUNCTION owned_directory_audit_failure()`:`CREATE TRIGGER owned_directory_audit_failure BEFORE INSERT ON admin_audit_events WHEN NEW.event_type='admin_password_changed' BEGIN SELECT RAISE(ABORT,'owned directory audit failure'); END`);
    const failed=await request('PATCH','/user/2/password',{p:changed+'failed',oldPassword:changed},regularToken);assert.equal(failed.status,500);assert.equal(failed.text,'Internal error.');assert.equal(failed.headers.get('content-type'),'text/html;charset=UTF-8');assert.equal(failed.headers.get('authtoken'),null);assert.ok(failed.headers.get('error-id'));assert.equal(failed.text.includes(regularToken),false);
    const retained=await request('GET','/session',undefined,regularToken);assert.equal(retained.status,200);assert.equal(retained.value.pwSetByAdmin,false);
   }finally{
    await exec(postgres?'DROP TRIGGER owned_directory_audit_failure ON admin_audit_events; DROP FUNCTION owned_directory_audit_failure()':'DROP TRIGGER owned_directory_audit_failure');if(postgres)await control.end();else control.close();
   }
  });
  await t.test('super reset revokes the target without issuing an impersonation capability or replacing the root',async()=>{
   const r=await request('PATCH','/user/2/password',{p:password,oldPassword:42},rootToken);assert.equal(r.status,200);assert.equal(r.text,'');assert.equal(r.headers.get('authtoken'),null);
   assert.equal((await request('GET','/session',undefined,regularToken)).status,403);assert.equal((await request('GET','/users',undefined,rootToken)).status,200);
   const regular=await request('PUT','/session/admin',{name:'OwnedÄdmin',password});assert.equal(regular.status,200);assert.equal(regular.value.pwSetByAdmin,true);
  });
  await t.test('actual native paths and JSON keep high administrator IDs exact',async()=>{
   await storage.repository.mutateOriginalAdminSession({token:rootToken},()=>({counter:'9007199254740992'}));
   const created=await request('PUT','/user',{n:'OwnedHighHttp',p:password},rootToken);assert.equal(created.status,201);assert.equal(created.text,'9007199254740993');
   const directory=await request('GET','/users',undefined,rootToken);assert.match(directory.text,/"id":9007199254740993,/);
   const login=await request('PUT','/session/admin',{name:'OwnedHighHttp',password});assert.match(login.text,/"id":9007199254740993,/);
   const change=await request('PATCH','/user/9007199254740993/password',{p:changed,oldPassword:password},login.value.token);assert.equal(change.status,200);
   const read=await request('GET','/session',undefined,change.headers.get('authtoken'));assert.equal(read.status,200);assert.match(read.text,/"id":9007199254740993,/);
  });
 }finally{if(server){server.closeAllConnections();await new Promise(done=>server.close(done));}await storage?.shutdown();if(created)await pool.query(`DROP SCHEMA "${schema}" CASCADE`);await pool?.end();await rm(dir,{recursive:true,force:true});}
});
