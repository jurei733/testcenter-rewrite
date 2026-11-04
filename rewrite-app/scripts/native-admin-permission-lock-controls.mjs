import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

/** Real independent PostgreSQL clients; no authorization, rows, writes or
 * return values are stubbed. Only owned locks control the interleaving. */
export async function verifyNativePermissionLocks(t,f){
  const pool=new Pool({connectionString:f.url.toString()});
  const waiting=async(query,exclude)=>{
    const deadline=Date.now()+10000;
    while(Date.now()<deadline){
      const result=await pool.query("SELECT pid FROM pg_stat_activity WHERE application_name=$1 AND pid<>$2 AND wait_event_type='Lock' AND query LIKE $3",[f.schema,exclude,'%'+query+'%']);
      if(result.rowCount)return;await delay(5);
    }
    throw Error('Actual PostgreSQL operation never reached its owned lock: '+query);
  };
  const counterWait=async(action,whileHeld)=>{
    const client=await pool.connect();let pending;
    try{
      await client.query('BEGIN');const {rows:[{pid}]}=await client.query('SELECT pg_backend_pid() AS pid');
      await client.query('SELECT last_number FROM original_admin_number_counter WHERE singleton=1 FOR UPDATE');
      pending=action();void pending.catch(()=>{});
      await waiting('SELECT last_number FROM original_admin_number_counter',pid);
      await whileHeld();await client.query('COMMIT');return await pending;
    }finally{await client.query('ROLLBACK');if(pending)await Promise.allSettled([pending]);client.release();}
  };
  try{
    await t.test('actual complete replacement includes a canonical grant inserted while its identity counter waits',async()=>{
      await f.setWorkspaces({ws:[{id:1,role:'RW'}]});
      const role={roleAssignmentId:randomUUID(),adminUserId:f.a.adminUserId,role:'workspace_admin',accessMode:'read_write',
        tenantId:f.tenant.tenantId,workspaceId:f.two.workspaceId,groupKey:null,monitorProfiles:[],monitorBookletVisibility:'visible',createdAt:f.now()};
      await counterWait(()=>f.setWorkspaces({ws:[{id:1,role:'RO'}]}),()=>f.repository.saveAdminRoleAssignment(role));
      const rows=JSON.parse(await f.workspaces());assert.equal(rows.find(r=>r.id===1).role,'RO');assert.equal(rows.find(r=>r.id===2).selected,false);
      assert.equal((await f.repository.listAdminRoleAssignmentsByUserId(f.a.adminUserId)).some(r=>r.roleAssignmentId===role.roleAssignmentId),false);
    });
    const rootUser=await f.repository.getAdminUserByUsername('super');
    const rootRole=(await f.repository.listAdminRoleAssignmentsByUserId(rootUser.adminUserId)).find(r=>r.role==='platform_admin');
    const backup=await f.services.originalAdminSession.login({name:f.b.username,password:f.password});
    const revoke=()=>f.services.adminDirectory.revokeAdminRole({sessionToken:backup.token,adminUserId:rootUser.adminUserId,roleAssignmentId:rootRole.roleAssignmentId,confirmationPassword:f.password});
    await t.test('Root revocation committed during an actual counter wait rejects the complete permission mutation',async()=>{
      const before=(await f.allRoles()).filter(r=>r.roleAssignmentId!==rootRole.roleAssignmentId);let audits;
      try{
        await assert.rejects(counterWait(()=>f.setUsers({u:[{id:2,role:'RW'}]}),async()=>{await revoke();audits=await f.repository.listAdminAuditEvents();}),e=>e.statusCode===403);
        assert.deepEqual(await f.allRoles(),before);assert.deepEqual(await f.repository.listAdminAuditEvents(),audits);
      }finally{await f.repository.saveAdminRoleAssignment(rootRole);}
    });
    await t.test('the actual grant-set lock holds Root revocation through permission and audit commit',async()=>{
      await f.setWorkspaces({ws:[{id:1,role:'RO'}]});
      const key=Math.floor(Math.random()*1000000000)+1000000000,client=await pool.connect();let pending,revoking;
      try{
        const {rows:[{pid}]}=await client.query('SELECT pg_backend_pid() AS pid');await client.query('SELECT pg_advisory_lock($1::bigint)',[key]);
        await pool.query(`CREATE FUNCTION owned_permission_commit_hold() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(${key}::bigint); RETURN NEW; END $$;
          CREATE TRIGGER owned_permission_commit_hold BEFORE INSERT ON admin_audit_events FOR EACH ROW WHEN (NEW.summary LIKE 'Native workspace permission %') EXECUTE FUNCTION owned_permission_commit_hold()`);
        pending=f.setWorkspaces({ws:[{id:1,role:'RW'}]});void pending.catch(()=>{});await waiting('INSERT INTO admin_audit_events',pid);
        let revoked=false;revoking=revoke().then(()=>{revoked=true;});void revoking.catch(()=>{});
        await waiting('DELETE FROM admin_role_assignments',pid);assert.equal(revoked,false);
        await client.query('SELECT pg_advisory_unlock($1::bigint)',[key]);await pending;await revoking;
        const roles=await f.repository.listAdminRoleAssignmentsByUserId(f.a.adminUserId);assert.equal(roles.find(r=>r.role==='workspace_admin'&&r.workspaceId===f.one.workspaceId).accessMode,'read_write');
        await assert.rejects(f.users(),e=>e.statusCode===403);
      }finally{
        await client.query('SELECT pg_advisory_unlock($1::bigint)',[key]);await Promise.allSettled([pending,revoking].filter(Boolean));
        await pool.query('DROP TRIGGER IF EXISTS owned_permission_commit_hold ON admin_audit_events; DROP FUNCTION IF EXISTS owned_permission_commit_hold()');
        await f.repository.saveAdminRoleAssignment(rootRole);client.release();
      }
    });
    for(const change of ['logout','clock-expiry'])await t.test('native permission replacement rejects '+change+' after an actual PostgreSQL counter wait',async()=>{
      const session=await f.repository.getAdminSessionByToken(f.root.token),before=await f.allRoles(),timestamp=f.clock.value;let audits;
      try{
        await assert.rejects(counterWait(()=>f.setUsers({u:[{id:2,role:'RO'}]}),async()=>{
          if(change==='logout')await f.services.adminAuth.signOut({sessionToken:f.root.token});
          else f.clock.value=Date.parse(session.expiresAt)+1;
          audits=await f.repository.listAdminAuditEvents();
        }),e=>e.statusCode===403);
        assert.deepEqual(await f.allRoles(),before);assert.deepEqual(await f.repository.listAdminAuditEvents(),audits);
      }finally{f.clock.value=timestamp;await f.repository.saveAdminSession(session);await f.reopen();}
    });
  }finally{await pool.end();}
}
