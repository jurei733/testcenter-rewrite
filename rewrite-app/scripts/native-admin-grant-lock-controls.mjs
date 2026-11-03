import assert from 'node:assert/strict';
import {Pool,Client} from 'pg';
import {setTimeout as delay} from 'node:timers/promises';

async function actualLockWait(pool,pid){
 const until=Date.now()+5000;
 while(Date.now()<until){if((await pool.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0]?.wait_event_type==='Lock')return;await delay(10);}
 assert.fail('The owned independent PostgreSQL connection did not reach an actual lock wait.');
}
/** Preserve RR snapshots; an updated/deleted grant must retry the whole writer,
 * and revocation after authorization must wait for that writer's commit. */
export async function verifyNativeAdminGrantLocks(t,{repository,services,root,password,connectionString}){
 const observer=new Pool({connectionString}),rootSession=await repository.getAdminSessionByToken(root.token);
 const grant=(await repository.listAdminRoleAssignmentsByUserId(rootSession.adminUserId)).find(r=>r.role==='platform_admin');assert.ok(grant);
 const peer=await services.adminDirectory.createAdminUser({sessionToken:root.token,username:'owned-revoking-root',password,confirmationPassword:password,roleAssignments:[{role:'platform_admin'}]});
 const peerToken=(await services.adminAuth.signIn({username:peer.adminUser.username,password})).adminSession.token;
 const target=await repository.getAdminUserByUsername('OwnedÄdmin');assert.ok(target);
 const revoke=()=>services.adminDirectory.revokeAdminRole({sessionToken:peerToken,adminUserId:rootSession.adminUserId,roleAssignmentId:grant.roleAssignmentId,confirmationPassword:password});
 try{
  for(const change of ['delete','update'])for(const action of ['create','reset','users','workspaces','session'])await t.test(`PostgreSQL native ${action} observes Root grant ${change} committed during its actual counter wait`,{timeout:20000},async ctx=>{
   const blocker=await observer.connect(),entered=Promise.withResolvers(),query=Client.prototype.query;
   const name='owned-after-grant-'+change+'-'+action,beforeTarget=await repository.getAdminUserById(target.adminUserId),beforeSessions=(await repository.listAdminSessions()).filter(s=>s.adminUserId===target.adminUserId);
   const beforeCounter=String((await observer.query('SELECT last_number FROM original_admin_number_counter WHERE singleton=1')).rows[0].last_number);
   const auditIds=new Set((await repository.listAdminAuditEvents()).map(r=>r.adminAuditEventId));let pid,retries=0;
   await blocker.query('BEGIN');await blocker.query('SELECT last_number FROM original_admin_number_counter WHERE singleton=1 FOR UPDATE');
   const hook=ctx.mock.method(Client.prototype,'query',function(...args){
    const text=typeof args[0]==='string'?args[0]:'';
    if(text.includes('FROM original_admin_number_counter')&&text.includes('FOR UPDATE')){pid=this.processID;entered.resolve();}
    const result=query.apply(this,args);
    if(text.includes('FROM admin_role_assignments')&&text.includes('FOR SHARE')&&result?.catch)return result.catch(e=>{if(e.code==='40001')retries++;throw e;});
    return result;
   });
   const operation=()=>action==='create'?services.originalAdminDirectory.createUser({token:root.token,name,password}):action==='reset'?services.originalAdminSession.changePassword({token:root.token,adminNumber:'2',password:password+'denied-reset'}):action==='users'?services.originalAdminDirectory.listUsers({token:root.token}):action==='workspaces'?services.originalAdminDirectory.listWorkspaces({token:root.token}):services.originalAdminSession.read({token:root.token});
   const pending=operation().then(value=>({value}),error=>({error}));
   try{
    await Promise.race([entered.promise,pending.then(r=>{throw r.error??Error('Native operation missed the counter lock');})]);await actualLockWait(observer,pid);
    if(change==='delete')await revoke();else await repository.saveAdminRoleAssignment({...grant,role:'system_check'});
    assert.ok(!(await repository.listAdminRoleAssignmentsByUserId(rootSession.adminUserId)).some(r=>r.role==='platform_admin'));
    await blocker.query('COMMIT');const result=await pending;
    if(action==='session'){assert.ifError(result.error);assert.ok(!Object.hasOwn(result.value.claims,'superAdmin'));}
    else{assert.equal(result.error?.statusCode,action==='reset'?500:403);assert.equal(result.value,undefined);}
    assert.ok(retries>=1,'The stale RR grant must trigger a real40001 and complete-transaction retry.');
    assert.equal(await repository.getAdminUserByUsername(name),null);
    assert.deepEqual(await repository.getAdminUserById(target.adminUserId),beforeTarget);
    assert.deepEqual((await repository.listAdminSessions()).filter(s=>s.adminUserId===target.adminUserId),beforeSessions);
    assert.equal(String((await observer.query('SELECT last_number FROM original_admin_number_counter WHERE singleton=1')).rows[0].last_number),beforeCounter);
    const effects=(await repository.listAdminAuditEvents()).filter(r=>!auditIds.has(r.adminAuditEventId));assert.deepEqual(effects.map(r=>r.eventType),change==='delete'?['admin_role_revoked']:[]);
   }finally{await blocker.query('ROLLBACK');await pending;hook.mock.restore();blocker.release();await repository.saveAdminRoleAssignment(grant);}
  });
  await t.test('PostgreSQL native user creation holds its Root grant through the actual user/audit commit',{timeout:20000},async ctx=>{
   const entered=Promise.withResolvers(),release=Promise.withResolvers(),revokeEntered=Promise.withResolvers(),query=Client.prototype.query;let writerPid,revokePid;
   const hook=ctx.mock.method(Client.prototype,'query',function(...args){
    const text=typeof args[0]==='string'?args[0]:'';
    if(text.startsWith('INSERT INTO admin_users')&&!writerPid){writerPid=this.processID;entered.resolve();return release.promise.then(()=>query.apply(this,args));}
    if(writerPid&&this.processID!==writerPid&&text.includes('DELETE FROM admin_role_assignments')){revokePid=this.processID;revokeEntered.resolve();}
    return query.apply(this,args);
   });
   const pending=services.originalAdminDirectory.createUser({token:root.token,name:'owned-before-grant-revocation',password}).then(value=>({value}),error=>({error}));let revocation;
   try{
    await Promise.race([entered.promise,pending.then(r=>{throw r.error??Error('Creation missed its actual insertion boundary');})]);revocation=revoke();await revokeEntered.promise;await actualLockWait(observer,revokePid);
    release.resolve();const result=await pending;assert.ifError(result.error);assert.match(result.value,/^[1-9][0-9]+$/);await revocation;
    assert.ok(await repository.getAdminUserByUsername('owned-before-grant-revocation'));
    await assert.rejects(services.originalAdminDirectory.listUsers({token:root.token}),e=>e.statusCode===403);
   }finally{release.resolve();await Promise.allSettled([pending,...revocation?[revocation]:[]]);hook.mock.restore();await repository.saveAdminRoleAssignment(grant);}
  });
 }finally{await observer.end();}
}
