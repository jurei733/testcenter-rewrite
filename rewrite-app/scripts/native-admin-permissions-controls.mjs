import {sourcePermissionRow as source} from './source-native-workspace-permissions-evidence.mjs';
import {verifyNativePermissionLocks} from './native-admin-permission-lock-controls.mjs';
import {verifyNativePermissionBoundaries} from './native-admin-permission-boundary-controls.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Pool,types as pgTypes} from 'pg';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceStorage} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
import {createProductionApiServer} from '../apps/api/dist/apps/api/src/index.js';

const password='Owned permissions password';
const kindList=['memory','file','sqlite',...(process.env.FIRST_SLICE_STORE==='postgres'?['postgres']:[])];
const ordered=rows=>rows.toSorted((a,b)=>a.roleAssignmentId.localeCompare(b.roleAssignmentId));
const rejection=status=>error=>error.statusCode===status;
async function fixture(kind,t){
  const directory=await mkdtemp(join(tmpdir(),'owned-native-permissions-'));
  const file=join(directory,kind==='file'?'state.json':'state.sqlite');
  const schema='owned_permissions_'+randomUUID().replaceAll('-','');
  const url=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;
  url?.searchParams.set('options','-c search_path='+schema);url?.searchParams.set('application_name',schema);
  let pool,storage,repository,services;const cleanups=[];
  const clock={value:Date.now()},now=()=>new Date(clock.value).toISOString();
  if(url){pool=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await pool.query(`CREATE SCHEMA "${schema}"`);}
  const open=async()=>{
    storage=kind==='memory'?storage??{repository:createInMemoryFirstSliceRepository(),shutdown:async()=>{}}
      :kind==='file'?await createFileFirstSliceStorage(file):kind==='sqlite'?createSqliteFirstSliceStorage(file):await createPostgresFirstSliceStorage(url.toString());
    repository=storage.repository;services=createFirstSliceServices({repository,now});
  };
  await open();
  t.after(async()=>{for(const cleanup of cleanups)await cleanup();await storage?.shutdown();if(pool){await pool.query(`DROP SCHEMA "${schema}" CASCADE`);await pool.end();}await rm(directory,{recursive:true,force:true});});
  await services.adminAuth.bootstrapAdminUser({username:'super',password});
  const root=await services.originalAdminSession.login({name:'super',password});
  const tenant=await services.platform.createTenant({tenantKey:'owned-permissions',displayName:'Owned permissions'});
  const one=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'one',displayName:'Owned permissions One Ω'});
  const two=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'two',displayName:'Owned permissions Two β'});
  await services.originalAdminDirectory.listWorkspaces({token:root.token});
  assert.equal(await services.originalAdminDirectory.createUser({token:root.token,name:'Owned permissions A',password}),'2');
  assert.equal(await services.originalAdminDirectory.createUser({token:root.token,name:'Owned permissions B',password}),'3');
  const a=await repository.getAdminUserByUsername('Owned permissions A'),b=await repository.getAdminUserByUsername('Owned permissions B');
  const allRoles=async()=>ordered((await Promise.all((await repository.listAdminUsers()).map(u=>repository.listAdminRoleAssignmentsByUserId(u.adminUserId)))).flat());
  return {kind,file,url,schema,pool,clock,now,root,tenant,one,two,a,b,password,
    get repository(){return repository;},get services(){return services;},allRoles,beforeShutdown:callback=>cleanups.unshift(callback),
    async reopen(){if(kind!=='memory'){await storage.shutdown();storage=undefined;}await open();},
    users:()=>services.originalAdminPermissions.usersByWorkspace({token:root.token,reference:'1'}),
    workspaces:()=>services.originalAdminPermissions.workspacesByUser({token:root.token,reference:'2'}),
    setUsers:body=>services.originalAdminPermissions.replaceWorkspaceUsers({token:root.token,reference:'1',body}),
    setWorkspaces:body=>services.originalAdminPermissions.replaceUserWorkspaces({token:root.token,reference:'2',body})};
}

for(const kind of kindList)test(`${kind}: native permission matrices preserve Source scope and atomic current grants`,{timeout:120000},async t=>{
  const f=await fixture(kind,t);
  await t.test('actual Source DTO bytes, full replacement, ignored selected flag and live session revocation',async()=>{
    assert.equal(await f.users(),source('initial-workspace-users').rawText);
    assert.equal(await f.workspaces(),source('initial-user-workspaces').rawText);
    await f.setUsers({u:[{id:2,role:'RW'},{id:3,role:'RO'}]});
    assert.equal(await f.users(),source('mixed-workspace-users').rawText);
    assert.equal(await f.workspaces(),source('a-workspaces-after-mixed').rawText);
    await f.setWorkspaces({ws:[{id:1,role:'RO'},{id:2,role:'RW'}]});
    assert.equal(await f.workspaces(),source('a-workspaces-after-replace').rawText);
    assert.equal(await f.users(),source('one-users-after-a-replace').rawText);
    await f.setUsers({u:[{id:2,role:'RW',selected:false}]});
    assert.equal(await f.users(),source('workspace-after-selected-false').rawText);
    assert.equal(await f.services.originalAdminPermissions.workspacesByUser({token:f.root.token,reference:'3'}),source('b-after-workspace-replacement').rawText);
    const actor=await f.services.originalAdminSession.login({name:f.a.username,password});
    await f.setUsers({u:[{id:2,role:''}]});
    assert.equal(await f.users(),source('all-users-cleared').rawText);
    assert.equal(await f.workspaces(),source('other-workspace-survives-clear').rawText);
    assert.equal((await f.services.originalAdminSession.read({token:actor.token})).claims.workspaceAdmin.some(w=>w.id==='1'),false);
    await f.reopen();assert.equal(await f.workspaces(),source('other-workspace-survives-clear').rawText);
  });
  await t.test('unknown and PHP-alias targets keep Source directory semantics without an inherited grant',async()=>{
    const root=f.root.token;
    assert.equal(await f.services.originalAdminPermissions.usersByWorkspace({token:root,reference:'999999'}),source('unknown-workspace-matrix').rawText);
    assert.equal(await f.services.originalAdminPermissions.workspacesByUser({token:root,reference:'999999'}),source('unknown-user-matrix').rawText);
    for(const reference of ['01','1.9','1abc',' +1'])assert.equal(await f.services.originalAdminPermissions.usersByWorkspace({token:root,reference}),await f.users());
    assert.equal(JSON.parse(await f.users()).find(u=>u.id===1).selected,false);
  });
  await t.test('malformed collections and later invalid rows roll back the whole change and every audit',async()=>{
    await f.setUsers({u:[{id:2,role:'RO'},{id:3,role:'RW'}]});
    const before=await f.allRoles(),audits=await f.repository.listAdminAuditEvents();
    for(const body of [{},{u:null},{u:[]},{u:'bad'},{u:[{id:2,role:'RW'},{id:999999,role:'RO'}]},
      {u:[{id:2,role:'RO'},{id:2,role:'RW'}]},{u:[{id:2,role:null}]},{u:[{id:2.5,role:'RO'}]},
      {u:[{id:2,role:'XX'}]},{u:[{id:2,role:' RW '}]}]){
      await assert.rejects(f.setUsers(body));assert.deepEqual(await f.allRoles(),before);assert.deepEqual(await f.repository.listAdminAuditEvents(),audits);
    }
    await f.reopen();assert.deepEqual(await f.allRoles(),before);
    // An empty role deliberately skips even a missing ID in production Source.
    await f.setUsers({u:[{role:''}]});assert.ok(JSON.parse(await f.users()).every(r=>!r.selected));
  });
  await t.test('read-only metadata projections never turn Tenant, Root or monitor grants into workspace membership',async()=>{
    const other=await f.services.platform.createWorkspace({tenantKey:f.tenant.tenantKey,workspaceKey:'archived',displayName:'Hidden archived scope'});
    const row=(role,workspaceId,groupKey=null)=>({roleAssignmentId:randomUUID(),adminUserId:f.a.adminUserId,role,accessMode:'read_write',tenantId:f.tenant.tenantId,workspaceId,groupKey,monitorProfiles:[],monitorBookletVisibility:'visible',createdAt:f.now()});
    const tenantRole=row('tenant_admin',null),monitorRole=row('group_monitor',f.one.workspaceId,'OWNED'),hiddenRole=row('workspace_admin',other.workspaceId);
    for(const role of [tenantRole,monitorRole,hiddenRole])await f.repository.saveAdminRoleAssignment(role);
    await f.repository.saveWorkspace({tenantKey:f.tenant.tenantKey,workspaceKey:other.workspaceKey,workspace:{...other,status:'archived'}});
    await f.setWorkspaces({ws:[{role:''}]});
    const saved=await f.repository.listAdminRoleAssignmentsByUserId(f.a.adminUserId);
    for(const role of [tenantRole,monitorRole,hiddenRole])assert.deepEqual(saved.find(r=>r.roleAssignmentId===role.roleAssignmentId),role);
    assert.ok(JSON.parse(await f.workspaces()).every(r=>!r.selected));
    const before=await f.allRoles(),audits=await f.repository.listAdminAuditEvents();await f.users();await f.workspaces();assert.deepEqual(await f.allRoles(),before);assert.deepEqual(await f.repository.listAdminAuditEvents(),audits);
  });
  await t.test('a regular or revoked Root actor cannot inspect or replace the matrices',async()=>{
    const actor=await f.services.originalAdminSession.login({name:f.a.username,password});
    for(const action of [()=>f.services.originalAdminPermissions.usersByWorkspace({token:actor.token,reference:'1'}),
      ()=>f.services.originalAdminPermissions.replaceWorkspaceUsers({token:actor.token,reference:'1',body:{u:[{id:2,role:'RW'}]}})])await assert.rejects(action(),rejection(403));
    const rootUser=await f.repository.getAdminUserByUsername('super'),session=await f.repository.getAdminSessionByToken(f.root.token);
    const rootRole=(await f.repository.listAdminRoleAssignmentsByUserId(rootUser.adminUserId)).find(r=>r.role==='platform_admin');
    const backup={...rootRole,roleAssignmentId:randomUUID(),adminUserId:f.b.adminUserId};await f.repository.saveAdminRoleAssignment(backup);
    for(const invalidate of [async()=>f.repository.saveAdminUser({...rootUser,status:'disabled'}),
      async()=>f.repository.saveAdminSession({...session,revokedAt:f.now()}),async()=>f.repository.saveAdminSession({...session,expiresAt:new Date(f.clock.value-1).toISOString()}),
      async()=>f.repository.deleteAdminRoleAssignment(rootRole.roleAssignmentId)]){
      const before=await f.allRoles();await invalidate();
      await assert.rejects(f.setUsers({u:[{id:2,role:'RW'}]}),rejection(403));
      await f.repository.saveAdminUser(rootUser);await f.repository.saveAdminSession(session);await f.repository.saveAdminRoleAssignment(rootRole);
      assert.deepEqual(await f.allRoles(),before);
    }
  });
  await t.test('audit insertion failure cannot publish an otherwise valid permission update',async()=>{
    const before=await f.allRoles(),audits=await f.repository.listAdminAuditEvents();
    let generated=0;const bad=createFirstSliceServices({repository:f.repository,now:f.now,idGenerator:()=>{generated++;return audits[0].adminAuditEventId;}});
    await assert.rejects(bad.originalAdminPermissions.replaceWorkspaceUsers({token:f.root.token,reference:'1',body:{u:[{id:2,role:'RW'}]}}));
    assert.ok(generated>0);
    assert.deepEqual(await f.allRoles(),before);assert.deepEqual(await f.repository.listAdminAuditEvents(),audits);await f.reopen();assert.deepEqual(await f.allRoles(),before);
  });
  await t.test('a generated permission ID cannot overwrite a protected Root assignment',async()=>{
    const before=await f.allRoles(),audits=await f.repository.listAdminAuditEvents();
    const protectedRole=before.find(r=>r.role==='platform_admin');let generated=0;
    const colliding=createFirstSliceServices({repository:f.repository,now:f.now,idGenerator:()=>{generated++;return protectedRole.roleAssignmentId;}});
    await assert.rejects(colliding.originalAdminPermissions.replaceWorkspaceUsers({token:f.root.token,reference:'1',body:{u:[{id:2,role:'RW'}]}}));
    assert.ok(generated>0);assert.deepEqual(await f.allRoles(),before);assert.deepEqual(await f.repository.listAdminAuditEvents(),audits);
    await f.reopen();assert.deepEqual(await f.allRoles(),before);
  });
  if(kind==='sqlite'||kind==='postgres')await t.test('SQL permission metadata avoids decoding private Source packages and another user payload',async()=>{
    const marker='OWNED_PRIVATE_PERMISSION_DECODER_FENCE';
    await f.repository.saveSourcePackage({sourcePackageId:randomUUID(),tenantId:f.tenant.tenantId,workspaceId:f.one.workspaceId,fileName:'owned.xml',mediaType:'application/xml',sourceDocument:marker,
      contentStructure:{bookletEntries:[],privateFixtureMarker:marker},status:'accepted',uploadedAt:f.now()});
    const user=await f.repository.getAdminUserById(f.b.adminUserId);await f.repository.saveAdminUser({...user,customTexts:{privateFixtureMarker:marker}});
    const original=JSON.parse,parser=pgTypes.getTypeParser(3802);JSON.parse=text=>{if(typeof text==='string'&&text.includes(marker))throw Error('Private permission decoder fence');return original(text);};
    if(kind==='postgres')pgTypes.setTypeParser(3802,JSON.parse);
    try{assert.ok(JSON.parse(await f.users()).some(row=>row.name===f.a.username));assert.ok(JSON.parse(await f.workspaces()).some(row=>row.name===f.one.displayName));}
    finally{JSON.parse=original;if(kind==='postgres')pgTypes.setTypeParser(3802,parser);}
  });
  await verifyNativePermissionBoundaries(t,f);
  if(kind==='postgres')await verifyNativePermissionLocks(t,f);
});

test(`real ${process.env.FIRST_SLICE_STORE==='postgres'?'PostgreSQL':'SQLite'} native permission HTTP keeps exact int64 IDs, auth precedence and Source matrices`,{timeout:60000},async t=>{
  const f=await fixture(process.env.FIRST_SLICE_STORE==='postgres'?'postgres':'sqlite',t),previous=new Map();
  const env={FIRST_SLICE_STORE:f.kind,FIRST_SLICE_SQLITE_FILE:f.file,...f.url?{FIRST_SLICE_POSTGRES_URL:f.url.toString()}:{},FIRST_SLICE_BOOTSTRAP_DEMO:'false',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_PROOF_OF_WORK_SCOPES:''};
  for(const [key,value]of Object.entries(env)){previous.set(key,process.env[key]);process.env[key]=value;}
  let server;try{server=await createProductionApiServer();}finally{for(const[key,value]of previous)if(value===undefined)delete process.env[key];else process.env[key]=value;}
  await new Promise(done=>server.listen(0,'127.0.0.1',done));f.beforeShutdown(async()=>{server.closeAllConnections();await new Promise(done=>server.close(done));});
  const base='http://127.0.0.1:'+server.address().port;
  const request=async(method,path,body,token=f.root.token,raw)=>{const r=await fetch(base+path,{method,headers:{...(token===null?{}:{AuthToken:token}),...(body===undefined&&raw===undefined?{}:{'content-type':'application/json'})},...(raw===undefined?body===undefined?{}:{body:JSON.stringify(body)}:{body:raw}),signal:AbortSignal.timeout(15000)});return{status:r.status,text:await r.text(),headers:r.headers};};
  for(const path of ['/workspace/1/users','/user/2/workspaces']){
    const r=await request('GET',path);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store');
    assert.equal((await request('PATCH',path,undefined,null,'{')).status,401);
    const regular=await f.services.originalAdminSession.login({name:f.a.username,password});assert.equal((await request('PATCH',path,undefined,regular.token,'{')).status,403);
    assert.equal((await request('PATCH',path,undefined,f.root.token,'{')).status,500);
  }
  const changed=await request('PATCH','/workspace/1/users',{u:[{id:2,role:'RO'}]});assert.equal(changed.status,200);assert.equal(changed.text,'');assert.equal(changed.headers.get('content-type'),source('assign-mixed-users').contentType);
  await f.repository.mutateOriginalAdminSession({token:f.root.token,at:f.now()},()=>({counter:'9007199254740992'}));
  assert.equal(await f.services.originalAdminDirectory.createUser({token:f.root.token,name:'Owned high permissions',password}),'9007199254740993');
  const exact=await request('PATCH','/workspace/1/users',undefined,f.root.token,'{"u":[{"id":9007199254740993,"role":"RW"}]}');assert.equal(exact.status,200);
  const matrix=await request('GET','/workspace/1/users');assert.match(matrix.text,/"id":9007199254740993,"name":"Owned high permissions","selected":true,"role":"RW"/);
  assert.equal((await request('PATCH','/user/9007199254740993/workspaces',{ws:[{id:2,role:'RO'}]})).status,200);
  const user=await f.repository.getAdminUserByUsername('Owned high permissions'),roles=await f.repository.listAdminRoleAssignmentsByUserId(user.adminUserId);assert.equal(roles.length,1);assert.equal(roles[0].workspaceId,f.two.workspaceId);assert.equal(roles[0].accessMode,'read_only');
  await f.repository.mutateOriginalAdminSession({token:f.root.token,at:f.now()},()=>({workspaceCounter:'9007199254740992'}));
  const highWorkspace=await f.services.platform.createWorkspace({tenantKey:f.tenant.tenantKey,workspaceKey:'high',displayName:'Owned high permission workspace'});
  const highMatrix=await request('GET','/user/9007199254740993/workspaces');assert.match(highMatrix.text,/"id":9007199254740993,"name":"Owned high permission workspace","selected":false,"role":""/);
  assert.equal((await request('PATCH','/user/9007199254740993/workspaces',undefined,f.root.token,'{"ws":[{"id":9007199254740993,"role":"RW"}]}')).status,200);
  const highGrants=await f.repository.listAdminRoleAssignmentsByUserId(user.adminUserId);assert.equal(highGrants.length,1);assert.equal(highGrants[0].workspaceId,highWorkspace.workspaceId);
  const highUsers=await request('GET','/workspace/9007199254740993/users');assert.match(highUsers.text,/"id":9007199254740993,"name":"Owned high permissions","selected":true,"role":"RW"/);
  assert.equal((await request('PATCH','/workspace/9007199254740993/users',undefined,f.root.token,'{"u":[{"id":9007199254740993,"role":"RO"}]}')).status,200);
  const before=await f.allRoles();assert.equal((await request('PATCH','/workspace/1/users',undefined,f.root.token,'{"u":[{"id":9007199254740992,"role":"RW"}]}')).status,500);assert.deepEqual(await f.allRoles(),before);
  assert.equal((await request('PATCH','/user/9007199254740993/workspaces',undefined,f.root.token,'{"ws":[{"id":9007199254740992,"role":"RW"}]}')).status,500);assert.deepEqual(await f.allRoles(),before);
});
