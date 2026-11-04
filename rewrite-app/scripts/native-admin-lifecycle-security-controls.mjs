import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {Pool} from 'pg';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {handleOriginalAdminHttp} from '../apps/api/dist/apps/api/src/original-admin-http.js';

/** All requests, password checks and durable effects execute the production
 * code. Only body completion or entry to the writer is scheduled here. */
export async function verifyNativeAdminLifecycleSecurity(t,f,target){
 const actor=structuredClone(await f.repository.getAdminUserByUsername('super'));
 const rootRole=structuredClone((await f.repository.listAdminRoleAssignmentsByUserId(actor.adminUserId)).find(r=>r.role==='platform_admin'));
 const session=structuredClone(await f.repository.getAdminSessionByToken(f.root.token)),clock=f.clock.value;
 const backupRole={...rootRole,adminUserId:f.b.adminUserId,roleAssignmentId:randomUUID()};
 await f.repository.saveAdminRoleAssignment(backupRole);
 const backup=await f.services.originalAdminSession.login({name:f.b.username,password:f.password});
 const passwordUser='Owned lifecycle confirmation '+f.kind;
 await f.services.originalAdminDirectory.createUser({token:f.root.token,name:passwordUser,password:f.password+' replacement'});
 const changedHash=(await f.repository.getAdminUserByUsername(passwordUser)).passwordHash;
 const set=(state,services=f.services,token=f.root.token)=>services.originalAdminDirectory.setSuperadmin({token,reference:'4',status:state,body:{p:f.password}});
 const restore=async()=>{
  f.clock.value=clock;await f.repository.saveAdminUser(structuredClone(actor));
  await f.repository.saveAdminRoleAssignment(structuredClone(rootRole));await f.repository.saveAdminSession(structuredClone(session));await f.reopen();
 };
 const revoke=()=>f.services.adminDirectory.revokeAdminRole({sessionToken:backup.token,adminUserId:actor.adminUserId,roleAssignmentId:rootRole.roleAssignmentId,confirmationPassword:f.password});
 const cases=[
  ['logout',token=>f.services.adminAuth.signOut({sessionToken:token})],
  ['Root revocation',()=>revoke()],
  ['disabled account',()=>f.repository.saveAdminUser({...actor,status:'disabled'})],
  ['expired account',()=>f.repository.saveAdminUser({...actor,validTo:new Date(clock-1).toISOString()})],
  ['expired session',async token=>{const s=await f.repository.getAdminSessionByToken(token);await f.repository.saveAdminSession({...s,expiresAt:new Date(clock-1).toISOString()});}],
  ['clock crossing expiry',async token=>{const s=await f.repository.getAdminSessionByToken(token);f.clock.value=Date.parse(s.expiresAt)+1;}],
  ['confirmation password rotation',()=>f.repository.saveAdminUser({...actor,passwordHash:changedHash})]
 ];
 for(const boundary of ['body','durable-writer'])for(const operation of ['on','off'])for(const[label,invalidate]of cases){
  await t.test(`native Root ${operation} rejects ${label} after ${boundary} wait`,{timeout:20000},async()=>{
   await restore();await set(operation==='on'?'off':'on');
   const token=(await f.services.originalAdminSession.login({name:actor.username,password:f.password})).token;
   const entered=Promise.withResolvers(),release=Promise.withResolvers();let failure;
   const delayed=new Proxy(f.repository,{get(store,key){
    if(boundary==='durable-writer'&&key==='mutateOriginalAdminSession')return async(selector,...args)=>{
     if(selector.adminWrite==='superadmin'){entered.resolve();await release.promise;}
     return store[key](selector,...args);
    };
    const value=Reflect.get(store,key);return typeof value==='function'?value.bind(store):value;
   }});
   const services=boundary==='durable-writer'?createFirstSliceServices({repository:delayed,now:f.now}):f.services;
   const server=createServer((req,res)=>void handleOriginalAdminHttp({request:req,pathname:new URL(req.url,'http://owned.invalid').pathname,services,
    readBody:async decode=>{if(boundary==='body')entered.resolve();const chunks=[];for await(const chunk of req)chunks.push(chunk);return decode(Buffer.concat(chunks));},
    header:(name,value)=>res.setHeader(name,value),raw:(code,text,type)=>{res.writeHead(code,{'Content-Type':type});res.end(text);},
    propagateError:()=>false,reportError:()=>{}
   }).catch(error=>{failure=error;res.writeHead(500);res.end();}));
   await new Promise(done=>server.listen(0,'127.0.0.1',done));let req;
   try{
    const payload=JSON.stringify({p:f.password}),response=Promise.withResolvers();
    req=request({hostname:'127.0.0.1',port:server.address().port,path:'/user/4/super-admin/'+operation,method:'PATCH',headers:{AuthToken:token,'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)},signal:AbortSignal.timeout(15000)},res=>{
     const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>response.resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString()}));
    });req.on('error',response.reject);
    if(boundary==='body')req.write(payload.slice(0,1));else req.end(payload);
    await Promise.race([entered.promise,response.promise.then(r=>{throw Error('Root request missed held boundary: '+r.status);})]);
    await invalidate(token);const roles=await f.allRoles(),audits=await f.repository.listAdminAuditEvents();
    release.resolve();if(boundary==='body')req.end(payload.slice(1));
    const result=await response.promise;assert.ifError(failure);assert.equal(result.status,403);
    assert.equal(result.headers['cache-control'],'private, no-store');assert.equal(result.headers['test-mode'],'NO');assert.ok(result.headers['error-id']);assert.equal(result.body.includes(token),false);
    if(label==='confirmation password rotation')assert.equal(result.body,'Invalid password for user 1');
    assert.deepEqual(await f.allRoles(),roles);assert.deepEqual(await f.repository.listAdminAuditEvents(),audits);
   }finally{release.resolve();req?.destroy();server.closeAllConnections();await new Promise(done=>server.close(done));await restore();}
  });
 }
 await set('off');
 await t.test('immutable storage metadata rejects forged Root and removal of another scope',async()=>{
  const peer=await f.services.originalAdminSession.login({name:f.a.username,password:f.password});let metadata;
  await f.repository.mutateOriginalAdminSession({token:f.root.token,at:f.now(),directory:'users',adminWrite:'superadmin'},s=>{metadata=structuredClone(s);return{};});
  const before=await f.allRoles(),audits=await f.repository.listAdminAuditEvents();
  const forged={...f.repository,mutateOriginalAdminSession:(selector,transform)=>f.repository.mutateOriginalAdminSession(selector,s=>{
   s.roles=[{...rootRole,adminUserId:s.user.adminUserId,roleAssignmentId:randomUUID()}];s.directory=structuredClone(metadata.directory);return transform(s);
  })};
  await assert.rejects(set('on',createFirstSliceServices({repository:forged,now:f.now}),peer.token),/Root writer authorization changed/);
  assert.deepEqual(await f.allRoles(),before);assert.deepEqual(await f.repository.listAdminAuditEvents(),audits);
  await set('on');
  const granted=await f.allRoles(),grantedAudits=await f.repository.listAdminAuditEvents();
  for(const edit of [
   effect=>{effect.rootRoleChange.removeIds=[rootRole.roleAssignmentId];},
   effect=>{effect.audit.subjectAdminUserId=actor.adminUserId;},
   effect=>{effect.roleChanges={scope:{kind:'user',adminUserId:target.adminUserId},removeIds:[],assignments:[]};}
  ]){
   const repository={...f.repository,mutateOriginalAdminSession:(selector,transform)=>f.repository.mutateOriginalAdminSession(selector,s=>{const effect=transform(s);if(effect.rootRoleChange)edit(effect);return effect;})};
   await assert.rejects(set('off',createFirstSliceServices({repository,now:f.now})));
   assert.deepEqual(await f.allRoles(),granted);assert.deepEqual(await f.repository.listAdminAuditEvents(),grantedAudits);
  }
  await set('off');
  const collision={...f.repository,mutateOriginalAdminSession:(selector,transform)=>f.repository.mutateOriginalAdminSession(selector,s=>{
   const effect=transform(s);if(effect.rootRoleChange)effect.rootRoleChange.assignment.roleAssignmentId=rootRole.roleAssignmentId;return effect;
  })};
  const offRoles=await f.allRoles(),offAudits=await f.repository.listAdminAuditEvents();
  await assert.rejects(set('on',createFirstSliceServices({repository:collision,now:f.now})));
  assert.deepEqual(await f.allRoles(),offRoles);assert.deepEqual(await f.repository.listAdminAuditEvents(),offAudits);
 });
 await t.test('Root metadata keeps the established password-change flag exemption',async()=>{
  await f.repository.saveAdminUser({...actor,passwordChangeRequired:true});
  try{await set('on');await set('off');}finally{await restore();}
 });
 if(f.kind==='postgres'){
  const pool=new Pool({connectionString:f.url.toString()});
  const waiting=async(fragment)=>{
   const deadline=Date.now()+10000;
   while(Date.now()<deadline){
    const found=await pool.query("SELECT pid FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE $2",[f.schema,'%'+fragment+'%']);
    if(found.rowCount)return;await delay(5);
   }
   throw Error('Native Root operation never reached its actual PostgreSQL wait: '+fragment);
  };
  try{
   for(const operation of ['on','off'])for(const invalidation of ['password','role','expiry'])await t.test(`actual PostgreSQL ${operation} table wait rechecks ${invalidation}`,async()=>{
    await restore();await set(operation==='on'?'off':'on');
    const roles=await f.allRoles(),audits=await f.repository.listAdminAuditEvents(),client=await pool.connect();let pending;
    try{
     await client.query('BEGIN');await client.query('LOCK TABLE admin_users IN ROW EXCLUSIVE MODE');
     pending=set(operation).then(value=>({value}),error=>({error}));await waiting('LOCK TABLE admin_users,admin_role_assignments');
     if(invalidation==='password')await client.query('UPDATE admin_users SET password_hash=$1 WHERE admin_user_id=$2',[changedHash,actor.adminUserId]);
     else if(invalidation==='role')await client.query('DELETE FROM admin_role_assignments WHERE role_assignment_id=$1',[rootRole.roleAssignmentId]);
     else f.clock.value=Date.parse(session.expiresAt)+1;
     await client.query('COMMIT');const result=await pending;
     assert.equal(result.error?.statusCode,403);assert.equal(result.error?.errorCode,invalidation==='password'?'original_confirmation_password_incorrect':invalidation==='role'?'original_super_admin_required':'original_admin_session_invalid');
     assert.deepEqual(await f.allRoles(),invalidation==='role'?roles.filter(r=>r.roleAssignmentId!==rootRole.roleAssignmentId):roles);
     assert.deepEqual(await f.repository.listAdminAuditEvents(),audits);
    }finally{await client.query('ROLLBACK');if(pending)await pending;client.release();await restore();}
   });
   await t.test('actual Root grant lock holds canonical revocation until role and audit commit',async()=>{
    await set('off');const client=await pool.connect(),key=Math.floor(Math.random()*1000000000)+1000000000;let pending,revoking;
    try{
     await client.query('SELECT pg_advisory_lock($1::bigint)',[key]);
     await pool.query(`CREATE FUNCTION owned_root_commit_hold() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(${key}::bigint); RETURN NEW; END $$;
      CREATE TRIGGER owned_root_commit_hold BEFORE INSERT ON admin_audit_events FOR EACH ROW WHEN (NEW.summary LIKE 'Native Root role %') EXECUTE FUNCTION owned_root_commit_hold()`);
     pending=set('on');void pending.catch(()=>{});await waiting('INSERT INTO admin_audit_events');
     let revoked=false;revoking=revoke().then(()=>{revoked=true;});void revoking.catch(()=>{});await waiting('DELETE FROM admin_role_assignments');assert.equal(revoked,false);
     await client.query('SELECT pg_advisory_unlock($1::bigint)',[key]);await pending;await revoking;
     assert.equal((await f.repository.listAdminRoleAssignmentsByUserId(target.adminUserId)).filter(r=>r.role==='platform_admin').length,1);
     await assert.rejects(set('off'),error=>error.statusCode===403);
    }finally{
     await client.query('SELECT pg_advisory_unlock($1::bigint)',[key]);await Promise.allSettled([pending,revoking].filter(Boolean));
     await pool.query('DROP TRIGGER IF EXISTS owned_root_commit_hold ON admin_audit_events; DROP FUNCTION IF EXISTS owned_root_commit_hold()');client.release();await restore();await set('off');
    }
   });
  }finally{await pool.end();}
 }
}
