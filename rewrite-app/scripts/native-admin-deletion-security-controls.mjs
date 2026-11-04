import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {Pool} from 'pg';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {handleOriginalAdminHttp} from '../apps/api/dist/apps/api/src/original-admin-http.js';

/** Actual handler/service/store throughout; controlled body completion,
 * writer entry and independent PostgreSQL locks schedule the interleavings. */
export async function verifyNativeAdminDeletionSecurity(t,f){
 const actor=structuredClone(await f.repository.getAdminUserByUsername('super'));
 const role=structuredClone((await f.repository.listAdminRoleAssignmentsByUserId(actor.adminUserId)).find(r=>r.role==='platform_admin'));
 const session=structuredClone(await f.repository.getAdminSessionByToken(f.root.token)),clock=f.clock.value;
 await f.repository.saveAdminRoleAssignment({...role,roleAssignmentId:randomUUID(),adminUserId:f.b.adminUserId});
 const backup=await f.services.originalAdminSession.login({name:f.b.username,password:f.password});
 const name='Owned deletion confirmation '+f.kind;
 await f.services.originalAdminDirectory.createUser({token:f.root.token,name,password:f.password+' replacement'});
 const changedHash=(await f.repository.getAdminUserByUsername(name)).passwordHash;
 const remove=(services=f.services,token=f.root.token,ids=['2'])=>services.originalAdminDirectory.deleteUsers({token,body:{u:ids,p:f.password}});
 const restore=async()=>{
  f.clock.value=clock;await f.repository.saveAdminUser(structuredClone(actor));await f.repository.saveAdminRoleAssignment(structuredClone(role));
  await f.repository.saveAdminSession(structuredClone(session));await f.reopen();
 };
 const revoke=()=>f.services.adminDirectory.revokeAdminRole({sessionToken:backup.token,adminUserId:actor.adminUserId,roleAssignmentId:role.roleAssignmentId,confirmationPassword:f.password});
 const cases=[
  ['logout',token=>f.services.adminAuth.signOut({sessionToken:token})],['Root revocation',()=>revoke()],
  ['disabled account',()=>f.repository.saveAdminUser({...actor,status:'disabled'})],
  ['expired account',()=>f.repository.saveAdminUser({...actor,validTo:new Date(clock-1).toISOString()})],
  ['expired session',async token=>{const s=await f.repository.getAdminSessionByToken(token);await f.repository.saveAdminSession({...s,expiresAt:new Date(clock-1).toISOString()});}],
  ['clock crossing expiry',async token=>{const s=await f.repository.getAdminSessionByToken(token);f.clock.value=Date.parse(s.expiresAt)+1;}],
  ['confirmation password rotation',()=>f.repository.saveAdminUser({...actor,passwordHash:changedHash})]
 ];
 for(const boundary of ['body','durable-writer'])for(const[label,invalidate]of cases)await t.test(`native user DELETE rejects ${label} after ${boundary} wait`,{timeout:20000},async()=>{
  await restore();const token=(await f.services.originalAdminSession.login({name:actor.username,password:f.password})).token;
  const entered=Promise.withResolvers(),release=Promise.withResolvers();let failure;
  const delayed=new Proxy(f.repository,{get(store,key){
   if(boundary==='durable-writer'&&key==='mutateOriginalAdminSession')return async(selector,...args)=>{
    if(selector.adminWrite==='delete-users'){entered.resolve();await release.promise;}return store[key](selector,...args);
   };
   const value=Reflect.get(store,key);return typeof value==='function'?value.bind(store):value;
  }});
  const services=boundary==='durable-writer'?createFirstSliceServices({repository:delayed,now:f.now}):f.services;
  const server=createServer((req,res)=>void handleOriginalAdminHttp({request:req,pathname:'/users',services,
   readBody:async decode=>{if(boundary==='body')entered.resolve();const chunks=[];for await(const chunk of req)chunks.push(chunk);return decode(Buffer.concat(chunks));},
   header:(name,value)=>res.setHeader(name,value),raw:(code,text,type)=>{res.writeHead(code,{'Content-Type':type});res.end(text);},propagateError:()=>false,reportError:()=>{}
  }).catch(error=>{failure=error;res.writeHead(500);res.end();}));
  await new Promise(done=>server.listen(0,'127.0.0.1',done));let req;
  try{
   const payload=JSON.stringify({u:['2'],p:f.password}),response=Promise.withResolvers();
   req=request({hostname:'127.0.0.1',port:server.address().port,path:'/users',method:'DELETE',headers:{AuthToken:token,'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)},signal:AbortSignal.timeout(15000)},res=>{
    const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>response.resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString()}));
   });req.on('error',response.reject);
   if(boundary==='body')req.write(payload.slice(0,1));else req.end(payload);
   await Promise.race([entered.promise,response.promise.then(r=>{throw Error('User deletion missed held boundary: '+r.status);})]);
   await invalidate(token);const users=await f.repository.listAdminUsers(),roles=await f.allRoles(),audits=await f.repository.listAdminAuditEvents();
   release.resolve();if(boundary==='body')req.end(payload.slice(1));
   const result=await response.promise;assert.ifError(failure);assert.equal(result.status,403);assert.equal(result.headers['cache-control'],'private, no-store');assert.ok(result.headers['error-id']);
   if(label==='confirmation password rotation')assert.equal(result.body,'Invalid password for user 1');
   assert.deepEqual(await f.repository.listAdminUsers(),users);assert.deepEqual(await f.allRoles(),roles);assert.deepEqual(await f.repository.listAdminAuditEvents(),audits);
  }finally{release.resolve();req?.destroy();server.closeAllConnections();await new Promise(done=>server.close(done));await restore();}
 });
 await t.test('native user DELETE preserves Root password-change flag exemption',async()=>{
  const id=await f.services.originalAdminDirectory.createUser({token:f.root.token,name:'Owned flag deletion '+f.kind,password:f.password});
  await f.repository.saveAdminUser({...actor,passwordChangeRequired:true});try{await remove(f.services,f.root.token,[id]);}finally{await restore();}
 });
 if(f.kind!=='postgres')return;
 const pool=new Pool({connectionString:f.url.toString()});
 const waiting=async fragment=>{
  const deadline=Date.now()+10000;
  while(Date.now()<deadline){const result=await pool.query("SELECT pid FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE $2",[f.schema,'%'+fragment+'%']);if(result.rowCount)return;await delay(5);}
  throw Error('Actual PostgreSQL deletion never reached held lock: '+fragment);
 };
 try{
  for(const invalidation of ['password','role','expiry'])await t.test(`actual PostgreSQL user deletion table wait rechecks ${invalidation}`,async()=>{
   const users=await f.repository.listAdminUsers(),roles=await f.allRoles(),audits=await f.repository.listAdminAuditEvents(),client=await pool.connect();let pending;
   try{
    await client.query('BEGIN');await client.query('LOCK TABLE admin_users IN ROW EXCLUSIVE MODE');
    pending=remove().then(value=>({value}),error=>({error}));await waiting('LOCK TABLE admin_users,admin_role_assignments');
    if(invalidation==='password')await client.query('UPDATE admin_users SET password_hash=$1 WHERE admin_user_id=$2',[changedHash,actor.adminUserId]);
    else if(invalidation==='role')await client.query('DELETE FROM admin_role_assignments WHERE role_assignment_id=$1',[role.roleAssignmentId]);
    else f.clock.value=Date.parse(session.expiresAt)+1;
    await client.query('COMMIT');const result=await pending;assert.equal(result.error?.statusCode,403);
    assert.equal(result.error?.errorCode,invalidation==='password'?'original_confirmation_password_incorrect':invalidation==='role'?'original_super_admin_required':'original_admin_session_invalid');
    assert.deepEqual((await f.repository.listAdminUsers()).filter(u=>u.adminUserId!==actor.adminUserId),users.filter(u=>u.adminUserId!==actor.adminUserId));
    assert.deepEqual(await f.allRoles(),invalidation==='role'?roles.filter(r=>r.roleAssignmentId!==role.roleAssignmentId):roles);assert.deepEqual(await f.repository.listAdminAuditEvents(),audits);
   }finally{await client.query('ROLLBACK');if(pending)await pending;client.release();await restore();}
  });
  await t.test('actual user deletion holds actor Root through target cleanup and audit commit',async()=>{
   const id=await f.services.originalAdminDirectory.createUser({token:f.root.token,name:'Owned held deletion',password:f.password});
   const client=await pool.connect(),key=Math.floor(Math.random()*1000000000)+1000000000;let pending,revoking;
   try{
    await client.query('SELECT pg_advisory_lock($1::bigint)',[key]);
    await pool.query(`CREATE FUNCTION owned_user_delete_hold() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(${key}::bigint); RETURN NEW; END $$;
     CREATE TRIGGER owned_user_delete_hold BEFORE INSERT ON admin_audit_events FOR EACH ROW WHEN (NEW.summary='Native administrator deleted') EXECUTE FUNCTION owned_user_delete_hold()`);
    pending=remove(f.services,f.root.token,[id]);void pending.catch(()=>{});await waiting('INSERT INTO admin_audit_events');
    let revoked=false;revoking=revoke().then(()=>{revoked=true;});void revoking.catch(()=>{});await waiting('DELETE FROM admin_role_assignments');assert.equal(revoked,false);
    await client.query('SELECT pg_advisory_unlock($1::bigint)',[key]);await pending;await revoking;
    assert.equal(await f.repository.getAdminUserByUsername('Owned held deletion'),null);await assert.rejects(remove(),error=>error.statusCode===403);
   }finally{
    await client.query('SELECT pg_advisory_unlock($1::bigint)',[key]);await Promise.allSettled([pending,revoking].filter(Boolean));
    await pool.query('DROP TRIGGER IF EXISTS owned_user_delete_hold ON admin_audit_events; DROP FUNCTION IF EXISTS owned_user_delete_hold()');client.release();await restore();
   }
  });
 }finally{await pool.end();}
}
