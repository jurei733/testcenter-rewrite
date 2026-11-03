import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Pool} from 'pg';
import {createFirstSliceServices,formatOriginalAdminAccessSet,prepareOriginalAdminNumber} from '@testcenter-rewrite-app/application';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceStorage} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
import {createProductionApiServer} from '../apps/api/dist/apps/api/src/index.js';
import {OriginalSessionProof} from '../apps/api/dist/apps/api/src/original-session-proof.js';

const rows=JSON.parse(await readFile(new URL('../test-fixtures/original-testcenter/source-workspace-results/native-admin-session-http/observations.json',import.meta.url),'utf8')).rows;
const oracle=label=>rows.find(row=>row.label===label);
const password='Owned-native-admin-password-2026!';
const secret='Owned-native-admin-sealed-challenge-secret-2026';
const code=expected=>error=>error.errorCode===expected;
const kinds=['memory','file','sqlite',...(process.env.FIRST_SLICE_STORE==='postgres'?['postgres']:[])];
const solve=challenge=>{
 for(let number=0;number<=challenge.maxNumber;number++)if(createHash('sha256').update(challenge.salt+number).digest('hex')===challenge.challenge)
  return {algorithm:challenge.algorithm,challenge:challenge.challenge,salt:challenge.salt,signature:challenge.signature,number};
 assert.fail('Actual encrypted five-field challenge must be solvable');
};
const role=(user,kind,scope={},accessMode='read_write')=>({roleAssignmentId:randomUUID(),adminUserId:user.adminUserId,role:kind,accessMode,
 tenantId:scope.tenantId??null,workspaceId:scope.workspaceId??null,groupKey:null,monitorProfiles:[],monitorBookletVisibility:'visible',createdAt:new Date().toISOString()});
const storedUser=async(repository,template,username,extra={})=>{
 const user={...template,adminUserId:randomUUID(),username,displayName:'Canonical display deliberately differs',passwordChangeRequired:true,...extra};
 await repository.saveAdminUser(user);return user;
};
const actualAccess=(actual,label)=>{
 const expected=oracle(label).value;
 // Every owned fresh store creates these two users in Source creation order.
 assert.equal(actual.id,String(expected.id));
 assert.deepEqual({...actual,id:Number(actual.id),token:expected.token},expected);
 assert.match(actual.token,/^[a-z0-9_-]{24}$/);
};

for(const kind of kinds)test(`${kind}: native Admin sessions preserve Source claims, current guards and atomic durable identity`,async t=>{
 const directory=await mkdtemp(join(tmpdir(),'owned-native-admin-')),file=join(directory,kind==='file'?'state.json':'state.sqlite');
 const schema='owned_admin_'+randomUUID().replaceAll('-',''),url=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;
 url?.searchParams.set('options','-c search_path='+schema);url?.searchParams.set('application_name',schema);
 let admin,created=false,storage,repository,services,clock=Date.parse('2026-11-02T12:00:00Z'),regular,root,rootToken,access,tenant,workspace,ro,peer;
 const now=()=>new Date(clock).toISOString();
 const open=async()=>{
  storage=kind==='memory'?storage??{repository:createInMemoryFirstSliceRepository(),shutdown:async()=>{}}:kind==='file'?await createFileFirstSliceStorage(file):kind==='sqlite'?createSqliteFirstSliceStorage(file):await createPostgresFirstSliceStorage(url.toString());
  repository=storage.repository;services=createFirstSliceServices({repository,now});
 };
 const reopen=async()=>{if(kind!=='memory'){await storage.shutdown();storage=undefined;}await open();};
 try{
  if(url){admin=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await admin.query(`CREATE SCHEMA "${schema}"`);created=true;}
  await open();root=(await services.adminAuth.bootstrapAdminUser({username:'super',password})).adminUser;
  regular=await storedUser(repository,root,'OwnedÄdmin');peer=await storedUser(repository,root,'NoWorkspaces');
  await t.test('root and no-grant regular AccessSets match actual production Source',async()=>{
   rootToken=await services.originalAdminSession.login({name:'SUPER',password});actualAccess(rootToken,'root-first');
   access=await services.originalAdminSession.login({name:'OwnedÄdmin',password});actualAccess(access,'admin-no-grants');
   assert.equal((await services.originalAdminSession.login({name:'NoWorkspaces',password})).id,'3');
   assert.equal((await repository.listAdminSessions()).filter(s=>s.adminUserId===regular.adminUserId&&s.revokedAt===null).length,1);
  });
  await t.test('German2 case lookup preserves stored name; spaces do not select that account; old token is revoked',async()=>{
   const old=access;access=await services.originalAdminSession.login({name:'ownedädmin',password});actualAccess(access,'admin-case-folded-name');
   await assert.rejects(services.originalAdminSession.read({token:old.token}),code('original_admin_session_invalid'));
   for(const name of [' OwnedÄdmin','OwnedÄdmin '])await assert.rejects(services.originalAdminSession.login({name,password}),code('original_admin_credentials_invalid'));
  });
  await t.test('live explicit RO/RW grants and renames match Source; platform/tenant roles add no implicit workspace',async()=>{
   tenant=await services.platform.createTenant({tenantKey:'owned-admin',displayName:'Owned native Admin'});
   workspace=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'zulu',displayName:'Zulu Ω'});
   const second=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'alpha',displayName:'Alpha Ä'});
   ro=role(regular,'workspace_admin',workspace,'read_only');await repository.saveAdminRoleAssignment(ro);await repository.saveAdminRoleAssignment(role(regular,'workspace_admin',second));
   access=await services.originalAdminSession.read({token:access.token});actualAccess(access,'session-live-explicit-grants');
   const rootAccess=await services.originalAdminSession.read({token:rootToken.token});assert.deepEqual(rootAccess.claims.workspaceAdmin,[]);
   await assert.rejects(services.originalWorkspaceAdministration.resolve({token:rootToken.token,workspacePathSegment:'1',write:false}),code('original_workspace_not_found'));
   // The Source password flag is returned, but existing protected Workspace
   // operations continue to require a completed password change.
   await assert.rejects(services.originalWorkspaceAdministration.resolve({token:access.token,workspacePathSegment:'1',write:false}),code('admin_password_change_required'));
   await repository.saveAdminUser({...regular,passwordChangeRequired:false});
   assert.equal((await services.originalWorkspaceAdministration.resolve({token:access.token,workspacePathSegment:'1',write:false})).workspaceId,workspace.workspaceId);
   await assert.rejects(services.originalWorkspaceAdministration.resolve({token:access.token,workspacePathSegment:'1',write:true}),code('original_workspace_read_only'));
   await repository.saveAdminUser({...regular,passwordChangeRequired:false,validFrom:new Date(clock+60_000).toISOString()});
   await assert.rejects(services.originalWorkspaceAdministration.resolve({token:access.token,workspacePathSegment:'1',write:false}),code('original_admin_token_invalid'));
   await repository.saveAdminUser(regular);
   await repository.saveWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'zulu',workspace:{...workspace,displayName:'Renamed native Ω'}});
   assert.equal((await services.originalAdminSession.read({token:access.token})).claims.workspaceAdmin[0].label,'Renamed native Ω');
   await repository.deleteAdminRoleAssignment(ro.roleAssignmentId);
   assert.deepEqual((await services.originalAdminSession.read({token:access.token})).access.workspaceAdmin,['2']);
   const platform=role(regular,'platform_admin');await repository.saveAdminRoleAssignment(platform);
   assert.deepEqual((await services.originalAdminSession.read({token:access.token})).claims.superAdmin,[]);
   await repository.deleteAdminRoleAssignment(platform.roleAssignmentId);
   assert.equal(Object.hasOwn((await services.originalAdminSession.read({token:access.token})).claims,'superAdmin'),false);
  });
  await t.test('refresh uses actual600-minute sliding lifetime; current user disable and access windows remain binding',async()=>{
   clock+=60_000;await services.originalAdminSession.read({token:access.token});
   assert.equal((await repository.getAdminSessionByToken(access.token)).expiresAt,new Date(clock+600*60_000).toISOString());
   await repository.saveAdminUser({...regular,status:'disabled'});await assert.rejects(services.originalAdminSession.read({token:access.token}),code('original_admin_session_invalid'));
   await repository.saveAdminUser({...regular,validTo:new Date(clock+90_000).toISOString()});
   await services.originalAdminSession.read({token:access.token});assert.equal((await repository.getAdminSessionByToken(access.token)).expiresAt,new Date(clock+90_000).toISOString());
   clock+=90_000;await assert.rejects(services.originalAdminSession.read({token:access.token}),code('original_admin_session_invalid'));
   await repository.saveAdminUser(regular);access=await services.originalAdminSession.login({name:regular.username,password});
  });
  await t.test('normalized aliases cannot bypass the failure limit; reset follows only a successful credential check',async()=>{
   const rate=await storedUser(repository,root,'RateOwned');
   for(let n=0;n<5;n++)await assert.rejects(services.originalAdminSession.login({name:n%2?'rateowned':'RateOwned',password:'wrong'}),code('original_admin_credentials_invalid'));
   await assert.rejects(services.originalAdminSession.login({name:'RATEOWNED',password}),code('admin_login_rate_limited'));
   assert.equal((await repository.getAdminLoginAttempt('rateowned')).failedAttempts,5);
   clock+=31*60_000;await services.originalAdminSession.login({name:rate.username,password});assert.equal((await repository.getAdminLoginAttempt('rateowned')).failedAttempts,0);
  });
  await t.test('parallel real repository connections retain exactly one current token and one stable number',async()=>{
   const extra=[];
   try{
    if(kind==='file')await assert.rejects(createFileFirstSliceStorage(file),error=>error.code==='FILE_STORE_BUSY');
    for(let n=0;n<2;n++)extra.push(kind==='memory'||kind==='file'?storage:kind==='sqlite'?createSqliteFirstSliceStorage(file):await createPostgresFirstSliceStorage(url.toString()));
    const all=[services,...extra.map(s=>createFirstSliceServices({repository:s.repository,now}))];
    const results=await Promise.all(Array.from({length:6},(_,n)=>all[n%all.length].originalAdminSession.login({name:regular.username,password})));
    assert.ok(results.every(r=>r.id==='2'));assert.equal(new Set(results.map(r=>r.token)).size,6);
    const current=(await repository.listAdminSessions()).filter(s=>s.adminUserId===regular.adminUserId&&s.revokedAt===null);
    assert.equal(current.length,1);access=results.find(r=>r.token===current[0].token);assert.ok(access);
    for(const old of results.filter(r=>r.token!==access.token))await assert.rejects(services.originalAdminSession.read({token:old.token}),code('original_admin_session_invalid'));
   }finally{for(const s of extra)if(s!==storage)await s.shutdown();}
  });
  await t.test('a real late session-ID conflict rolls back first-login metadata, rotation, failure reset and audit',async()=>{
   const orderedSessions=rows=>rows.sort((a,b)=>a.adminSessionId.localeCompare(b.adminSessionId)),orderedAudit=rows=>rows.sort((a,b)=>a.adminAuditEventId.localeCompare(b.adminAuditEventId));
   const beforeSessions=orderedSessions(await repository.listAdminSessions()),beforeUser=await repository.getAdminUserById(regular.adminUserId),beforeAudit=orderedAudit(await repository.listAdminAuditEvents());
   const conflicting=createFirstSliceServices({repository,now,idGenerator:()=>beforeSessions.find(s=>s.adminUserId===peer.adminUserId).adminSessionId});
   await assert.rejects(conflicting.originalAdminSession.login({name:regular.username,password}),/collision|conflict/i);
   await reopen();assert.deepEqual(await repository.getAdminUserById(regular.adminUserId),beforeUser);
   assert.deepEqual(orderedSessions(await repository.listAdminSessions()),beforeSessions);assert.deepEqual(orderedAudit(await repository.listAdminAuditEvents()),beforeAudit);
   await services.originalAdminSession.read({token:access.token});
  });
  await t.test('canonical password change still revokes native tokens; logout and durable reopen cannot resurrect them',async()=>{
   await services.adminAuth.changeOwnPassword({sessionToken:access.token,currentPassword:password,password:password+'changed'});
   await assert.rejects(services.originalAdminSession.read({token:access.token}),code('original_admin_session_invalid'));
   access=await services.originalAdminSession.login({name:regular.username,password:password+'changed'});assert.equal(access.pwSetByAdmin,false);
   await services.originalAdminSession.logout({token:access.token});await reopen();
   await assert.rejects(services.originalAdminSession.read({token:access.token}),code('original_admin_session_invalid'));
   const peerAccess=await services.originalAdminSession.login({name:peer.username,password});assert.equal(peerAccess.id,'3');
  });
  await t.test('deletion never reuses an Admin ID; int64 formatting preserves tokens beyond Number.MAX_SAFE_INTEGER',async()=>{
   await repository.deleteAdminUser(regular.adminUserId);await reopen();
   const next=await storedUser(repository,root,'CreatedAfterDelete');assert.ok(BigInt((await services.originalAdminSession.login({name:next.username,password})).id)>3n);
   const mapping=prepareOriginalAdminNumber(next,null,'9007199254740992');assert.equal(mapping.number.adminNumber,'9007199254740993');
   const raw=formatOriginalAdminAccessSet({...rootToken,id:mapping.number.adminNumber});assert.match(raw,/"id":9007199254740993,/);assert.equal(raw.includes('9007199254740992'),false);
   assert.throws(()=>prepareOriginalAdminNumber(next,null,'9223372036854775807'),/exhausted/);
   // Owned fixture counter, not a claim about high-ID Source database history.
   await repository.mutateOriginalAdminSession({token:rootToken.token},()=>({counter:'9007199254740992'}));
   const high=await storedUser(repository,root,'OwnedHighId');await reopen();
   const highAccess=await services.originalAdminSession.login({name:high.username,password});assert.equal(highAccess.id,'9007199254740993');
   assert.match(formatOriginalAdminAccessSet(highAccess),/"id":9007199254740993,/);await reopen();assert.equal((await services.originalAdminSession.read({token:highAccess.token})).id,'9007199254740993');
   await repository.mutateOriginalAdminSession({token:rootToken.token},()=>({counter:'9223372036854775807'}));
   await assert.rejects(storedUser(repository,root,'ExhaustedOwnedUser'),/exhausted/);assert.equal(await repository.getAdminUserByUsername('ExhaustedOwnedUser'),null);
  });
 }finally{
  await storage?.shutdown();if(created){assert.equal(Number((await admin.query('SELECT count(*) AS n FROM pg_stat_activity WHERE application_name=$1',[schema])).rows[0].n),0);await admin.query(`DROP SCHEMA "${schema}" CASCADE`);}await admin?.end();await rm(directory,{recursive:true,force:true});
 }
});

test('native Admin encrypted proof keeps namespace, rotation, expiry and one-use boundaries',async()=>{
 const repository=createInMemoryFirstSliceRepository(),config={enabledScopes:['admin'],maxNumber:12,ttlMs:60_000,currentSecret:secret,previousSecret:null};
 let now=Date.now();const proof=new OriginalSessionProof(repository,config,()=>now),target={kind:'admin',name:'OwnedÄdmin',password};
 assert.throws(()=>proof.directAllowed('admin',''),code('original_work_required'));
 const challenge=proof.create(target),solution=solve(challenge);assert.equal(JSON.stringify(challenge).includes(password),false);assert.equal(challenge.salt.includes('Owned'),false);
 const rotated=new OriginalSessionProof(repository,{...config,currentSecret:secret+'new',previousSecret:secret},()=>now);
 assert.deepEqual(await rotated.consume(solution),target);await assert.rejects(proof.consume(solution),code('original_work_replayed'));
 const expired=solve(proof.create(target));now+=60_000;await assert.rejects(proof.consume(expired),code('original_work_expired'));
});

test(`real ${process.env.FIRST_SLICE_STORE==='postgres'?'PostgreSQL':'SQLite'} native Admin HTTP matches Source shapes and error precedence with actual sealed login`,async t=>{
 const directory=await mkdtemp(join(tmpdir(),'owned-native-admin-http-')),file=join(directory,'state.sqlite');
 const schema='owned_admin_http_'+randomUUID().replaceAll('-',''),postgres=process.env.FIRST_SLICE_STORE==='postgres',url=postgres?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;
 url?.searchParams.set('options','-c search_path='+schema);url?.searchParams.set('application_name',schema);
 let pool,storage,server,created=false,base;
 const env={FIRST_SLICE_STORE:postgres?'postgres':'sqlite',FIRST_SLICE_SQLITE_FILE:file,FIRST_SLICE_BOOTSTRAP_DEMO:'false',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',
  FIRST_SLICE_PROOF_OF_WORK_SCOPES:'admin,participant,second_code',FIRST_SLICE_PROOF_OF_WORK_SECRET:secret,FIRST_SLICE_PROOF_OF_WORK_PREVIOUS_SECRET:'',FIRST_SLICE_PROOF_OF_WORK_MAX_NUMBER:'12',FIRST_SLICE_PROOF_OF_WORK_TTL_MS:'60000',...(url?{FIRST_SLICE_POSTGRES_URL:url.toString()}:{})};
 const previous=new Map(Object.keys(env).map(key=>[key,process.env[key]]));
 const start=async scopes=>{
  if(server){server.closeAllConnections();await new Promise(done=>server.close(done));}
  try{Object.assign(process.env,env,{FIRST_SLICE_PROOF_OF_WORK_SCOPES:scopes});server=await createProductionApiServer();}
  finally{for(const[key,value]of previous)if(value===undefined)delete process.env[key];else process.env[key]=value;}
  await new Promise(done=>server.listen(0,'127.0.0.1',done));base='http://127.0.0.1:'+server.address().port;
 };
 const request=async(method,path,body,token)=>{
  const response=await fetch(base+path,{method,headers:{...(body===undefined?{}:{'content-type':'application/json'}),...(token===undefined?{}:{AuthToken:token})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
  const text=await response.text();return {status:response.status,text,headers:response.headers,value:response.headers.get('content-type')?.includes('application/json')?JSON.parse(text):text};
 };
 try{
  if(postgres){pool=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await pool.query(`CREATE SCHEMA "${schema}"`);created=true;}
  await start('admin,participant,second_code');storage=postgres?await createPostgresFirstSliceStorage(url.toString()):createSqliteFirstSliceStorage(file);
  const services=createFirstSliceServices({repository:storage.repository});await services.adminAuth.bootstrapAdminUser({username:'super',password});
  await t.test('protected direct login rejects empty password too, but required-field errors keep precedence',async()=>{
   for(const body of [{name:'super',password},{name:'super',password:''}]){const r=await request('PUT','/session/admin',body);assert.equal(r.status,400);assert.equal(r.value,oracle('protected-direct-valid-name').value);}
   const r=await request('PUT','/session/admin',{name:'super'});assert.equal(r.value,oracle('protected-direct-missing-password').value);
  });
  let access;
  await t.test('actual protected five-field HTTP creates Admin AccessSet, rotates and rejects replay with no participant fallback',async()=>{
   const challenge=await request('POST','/session/challenge',{loginType:'admin',name:'SUPER',password});assert.equal(challenge.status,200);assert.equal(challenge.text.includes(password),false);
   const solution=solve(challenge.value),response=await request('PUT','/session',solution);assert.equal(response.status,200);access=response.value;assert.deepEqual({...access,token:oracle('root-first').value.token},oracle('root-first').value);
   assert.equal((await request('PUT','/session',solution)).status,409);
   const read=await request('GET','/session',undefined,access.token);assert.equal(read.status,200);assert.deepEqual(read.value,access);
   assert.equal((await request('DELETE','/session',undefined,access.token)).status,205);
   const old=await request('GET','/session',undefined,access.token);assert.equal(old.status,403);assert.equal(old.value,'Invalid token.');assert.equal(old.text.includes(access.token),false);
  });
  await start('participant,second_code');
  await t.test('unprotected scalar/missing/byte-length errors and method/header statuses match captured Source',async()=>{
   const cases=[['direct-missing-name',{password}],['direct-missing-password',{name:'super'}],['direct-null-name',{name:null,password}],['direct-name-empty',{name:'',password}],['direct-name-over50',{name:'ä'.repeat(26),password}],['direct-name-number',{name:23,password}],['direct-password-number',{name:'super',password:23}],['direct-password-empty',{name:'super',password:''}]];
   for(const[label,body]of cases){const r=await request('PUT','/session/admin',body);assert.equal(r.status,oracle(label).status,label);assert.equal(r.value,oracle(label).value,label);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('test-mode'),'NO');}
   for(const[method,path,status]of [['GET','/session/admin',405],['GET','/session',401],['DELETE','/session',401]])assert.equal((await request(method,path)).status,status);
  });
  await t.test('fixed credential delay yields to the event loop, then successful direct login remains readable',async()=>{
   const startTime=performance.now(),pending=request('PUT','/session/admin',{name:'super',password});
   const independent=await request('GET','/session');assert.equal(independent.status,401);assert.ok(performance.now()-startTime<450,'The500ms credential delay must not block the event loop');
   const r=await pending;assert.equal(r.status,200);assert.ok(performance.now()-startTime>=490);assert.equal((await request('GET','/session',undefined,r.value.token)).status,200);
   await storage.repository.mutateOriginalAdminSession({token:r.value.token},()=>({counter:'9007199254740992'}));
   const root=await storage.repository.getAdminUserByUsername('super');await storedUser(storage.repository,root,'OwnedHighWire');
   const high=await request('PUT','/session/admin',{name:'OwnedHighWire',password});assert.equal(high.status,200);assert.match(high.text,/"id":9007199254740993,/);
  });
 }finally{
  if(server){server.closeAllConnections();await new Promise(done=>server.close(done));}await storage?.shutdown();if(created)await pool.query(`DROP SCHEMA "${schema}" CASCADE`);await pool?.end();await rm(directory,{recursive:true,force:true});
 }
});
