import assert from 'node:assert/strict';
import {Pool,Client} from 'pg';
import {setTimeout as delay} from 'node:timers/promises';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';

async function lockWait(pool,pid){
 const until=Date.now()+5000;
 while(Date.now()<until){if((await pool.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0]?.wait_event_type==='Lock')return;await delay(10);}
 assert.fail('The independent owned connection did not reach an actual PostgreSQL row-lock wait.');
}
export async function verifyNativeWorkspaceWritePostgres(t,{repository,services,ids,role,workspaceNumber,groupKey,connectionString}){
 const observer=new Pool({connectionString});
 const login=async()=>(await services.adminAuth.signIn({username:'writer',password:'Owned-test-admin-reader-secret'})).adminSession;
 try{
  for(const change of ['logout','clock-expiry'])await t.test('PostgreSQL native DELETE rechecks '+change+' after a real Workspace lock wait',{timeout:20000},async ctx=>{
   const session=await login();let timestamp=new Date().toISOString();
   const runtime=createFirstSliceServices({repository,now:()=>timestamp}),blocker=await observer.connect(),entered=Promise.withResolvers();let deletionPid;
   await blocker.query('BEGIN');await blocker.query('SELECT workspace_id FROM workspaces WHERE tenant_id=$1 AND workspace_id=$2 FOR UPDATE',[ids.tenantId,ids.workspaceId]);
   const query=Client.prototype.query,hook=ctx.mock.method(Client.prototype,'query',function(...args){
    if(typeof args[0]==='string'&&args[0].startsWith('SELECT workspace_id FROM workspaces')&&args[0].includes('FOR NO KEY UPDATE')){deletionPid=this.processID;entered.resolve();}
    return query.apply(this,args);
   });
   const pending=runtime.originalWorkspaceAdministration.delete({token:session.token,workspacePathSegment:workspaceNumber,kind:'groups',body:{groups:[groupKey]}}).then(value=>({value}),error=>({error}));
   try{
    await Promise.race([entered.promise,pending.then(v=>{throw v.error??Error('Deletion missed its row lock');})]);await lockWait(observer,deletionPid);
    if(change==='logout')await services.adminAuth.signOut({sessionToken:session.token});else timestamp=new Date(Date.parse(session.expiresAt)+1).toISOString();
    await blocker.query('COMMIT');const result=await pending;assert.equal(result.error?.statusCode,403);
    assert.ok((await repository.listOriginalParticipantGroupsByWorkspace(ids.tenantId,ids.workspaceId)).some(g=>g.groupKey===groupKey));
   }finally{await blocker.query('ROLLBACK');await pending;hook.mock.restore();blocker.release();}
  });
  await t.test('PostgreSQL native DELETE holds the current session and explicit grant until its own commit',{timeout:20000},async ctx=>{
   const session=await login(),entered=Promise.withResolvers(),release=Promise.withResolvers(),query=Client.prototype.query;let deletionPid,revocationPid,grantPid;
   const revokeEntry=Promise.withResolvers(),grantEntry=Promise.withResolvers();
   const hook=ctx.mock.method(Client.prototype,'query',function(...args){
    const text=typeof args[0]==='string'?args[0]:'';
    if(text.startsWith('DELETE FROM attachment_files')&&!deletionPid){deletionPid=this.processID;entered.resolve();return release.promise.then(()=>query.apply(this,args));}
    if(deletionPid&&this.processID!==deletionPid&&text.includes('INSERT INTO admin_sessions')){revocationPid=this.processID;revokeEntry.resolve();}
    if(deletionPid&&this.processID!==deletionPid&&text.includes('DELETE FROM admin_role_assignments')){grantPid=this.processID;grantEntry.resolve();}
    return query.apply(this,args);
   });
   const pending=services.originalWorkspaceAdministration.delete({token:session.token,workspacePathSegment:workspaceNumber,kind:'groups',body:{groups:[groupKey]}}).then(value=>({value}),error=>({error}));let revoking,removing;
   try{
    await Promise.race([entered.promise,pending.then(v=>{throw v.error??Error('Deletion missed its mutation boundary');})]);
    revoking=services.adminAuth.signOut({sessionToken:session.token});removing=repository.deleteAdminRoleAssignment(role.roleAssignmentId);
    await Promise.all([revokeEntry.promise,grantEntry.promise]);await lockWait(observer,revocationPid);await lockWait(observer,grantPid);
    release.resolve();assert.equal((await pending).error,undefined);await Promise.all([revoking,removing]);
    assert.ok(!(await repository.listOriginalParticipantGroupsByWorkspace(ids.tenantId,ids.workspaceId)).some(g=>g.groupKey===groupKey));
   }finally{release.resolve();await Promise.allSettled([pending,...(revoking?[revoking]:[]),...(removing?[removing]:[])]);hook.mock.restore();await repository.saveAdminRoleAssignment(role);}
  });
 }finally{await observer.end();}
}
