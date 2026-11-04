import {sourceOpaqueRoleRow,sourceOpaqueRoleCases} from './source-native-opaque-workspace-roles-evidence.mjs';
import {fixture} from './native-admin-permissions-controls.mjs';
import './native-opaque-workspace-role-http-controls.mjs';
import {resolveOperatorAccessMode} from '@testcenter-rewrite-app/contracts';
import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';

for(const kind of ['memory','file','sqlite',...(process.env.FIRST_SLICE_STORE==='postgres'?['postgres']:[])])test(`${kind}: opaque native workspace roles preserve Source state without granting access`,{timeout:120000},async t=>{
 const f=await fixture(kind,t);
 await f.repository.saveAdminUser({...f.a,passwordChangeRequired:false});
 const actor=await f.services.originalAdminSession.login({name:f.a.username,password:f.password});
 for(const family of ['workspace','user'])for(const[name,role]of sourceOpaqueRoleCases){
  await t.test(family+' '+name+' round-trips or fails atomically according to the actual Source role contract',async()=>{
   await f.setUsers({u:[{id:2,role:'RO'}]});
   const change=()=>family==='workspace'?f.setUsers({u:[{id:2,role}]}):f.setWorkspaces({ws:[{id:1,role}]});
   const label=family+'-'+name,write=sourceOpaqueRoleRow(label+'-write');
   if(write.status===500){
    const before=await f.allRoles(),audits=await f.repository.listAdminAuditEvents();
    await assert.rejects(change(),e=>e.statusCode===500);assert.deepEqual(await f.allRoles(),before);assert.deepEqual(await f.repository.listAdminAuditEvents(),audits);return;
   }
   assert.equal(write.status,200);await change();await f.reopen();
   const expected=sourceOpaqueRoleRow(label+'-matrix').value.find(r=>r.id===2),actual=JSON.parse(await f.users()).find(r=>r.id===2);
   assert.deepEqual({selected:actual.selected,role:actual.role},{selected:expected.selected,role:expected.role});
   const claim=(await f.services.originalAdminSession.read({token:actor.token})).claims.workspaceAdmin.find(r=>r.id==='1');
   assert.equal(claim?.flags.mode,expected.selected?expected.role:undefined);
   if(expected.selected&&expected.role!=='RO'&&expected.role!=='RW'){
    const current=await f.services.adminAuth.getCurrentSession({sessionToken:actor.token});assert.equal(resolveOperatorAccessMode(current.roleAssignments),'unassigned');
    await assert.rejects(f.services.adminDirectory.listAdminUsers({sessionToken:actor.token}),e=>e.statusCode===403);
   }
   for(const write of [false,true]){
    const expectedStatus=sourceOpaqueRoleRow(label+(write?'-delete':'-read')).status;
    const resolve=()=>f.services.originalWorkspaceAdministration.resolve({token:actor.token,workspacePathSegment:'1',write});
    if(expectedStatus===200)assert.equal((await resolve()).workspaceId,f.one.workspaceId);
    else await assert.rejects(resolve(),e=>e.statusCode===expectedStatus);
   }
  });
 }
 await t.test('a real RW grant in another workspace never authorizes an opaque scope, and both replacement directions keep their exact owner',async()=>{
  assert.equal(sourceOpaqueRoleRow('workspace-opaque-user-matrix').value.find(r=>r.id===2).role,'RW');
  await f.setWorkspaces({ws:[{id:1,role:'XX'},{id:2,role:'RW'}]});
  const current=await f.services.adminAuth.getCurrentSession({sessionToken:actor.token});assert.equal(resolveOperatorAccessMode(current.roleAssignments),'admin');
  for(const write of [false,true]){
   await assert.rejects(f.services.originalWorkspaceAdministration.resolve({token:actor.token,workspacePathSegment:'1',write}),e=>e.statusCode===403);
   assert.equal((await f.services.originalWorkspaceAdministration.resolve({token:actor.token,workspacePathSegment:'2',write})).workspaceId,f.two.workspaceId);
  }
  await f.setUsers({u:[{id:2,role:'XX'}]});assert.equal(JSON.parse(await f.workspaces()).find(r=>r.id===2).role,'RW');
  await f.setWorkspaces({ws:[{id:1,role:'RO'}]});await f.reopen();assert.equal(JSON.parse(await f.workspaces()).find(r=>r.id===2).selected,false);
  await assert.rejects(f.services.originalWorkspaceAdministration.resolve({token:actor.token,workspacePathSegment:'2',write:false}),e=>e.statusCode===404);
 });
 await t.test('opaque role audits retain the actual value and never describe it as an authorized read grant',async()=>{
  const before=new Set((await f.repository.listAdminAuditEvents()).map(r=>r.adminAuditEventId));
  await f.setUsers({u:[{id:2,role:'XX'}]});
  const events=(await f.repository.listAdminAuditEvents()).filter(r=>!before.has(r.adminAuditEventId));assert.equal(events.length,1);
  assert.equal(events[0].details.role,'native_workspace_opaque');assert.equal(events[0].details.nativeWorkspaceRole,'XX');assert.match(events[0].summary,/without access/);
  const auditCount=(await f.repository.listAdminAuditEvents()).length;await f.setUsers({u:[{id:2,role:'XX'}]});assert.equal((await f.repository.listAdminAuditEvents()).length,auditCount);
  await f.setUsers({u:[{id:2,role:'YY'}]});const changed=(await f.repository.listAdminAuditEvents()).filter(r=>r.details.nativeWorkspaceRole==='YY');assert.equal(changed.length,1);
  assert.equal(changed[0].details.roleAssignmentId,events[0].details.roleAssignmentId);
 });
 await t.test('opaque assignment ID collision cannot convert a protected Root or publish prior removals',async()=>{
  const before=await f.allRoles(),audits=await f.repository.listAdminAuditEvents(),root=before.find(r=>r.role==='platform_admin');let generated=0;
  const runtime=createFirstSliceServices({repository:f.repository,now:f.now,idGenerator:()=>++generated===1?root.roleAssignmentId:randomUUID()});
  await assert.rejects(runtime.originalAdminPermissions.replaceWorkspaceUsers({token:f.root.token,reference:'1',body:{u:[{id:3,role:'XX'}]}}));assert.ok(generated>=3);
  assert.deepEqual(await f.allRoles(),before);assert.deepEqual(await f.repository.listAdminAuditEvents(),audits);await f.reopen();assert.deepEqual(await f.allRoles(),before);
 });
 await t.test('missing or forged opaque role payload fails closed and never becomes a public authority',async()=>{
  await f.setUsers({u:[{id:2,role:'XX'}]});const valid=(await f.repository.listAdminRoleAssignmentsByUserId(f.a.adminUserId)).find(r=>r.workspaceId===f.one.workspaceId);
  try{
   for(const raw of [undefined,'RW']){
    await f.repository.saveAdminRoleAssignment({...valid,nativeWorkspaceRole:raw});await f.reopen();
    await assert.rejects(f.services.originalAdminSession.read({token:actor.token}),e=>e.statusCode===409);
    const current=await f.services.adminAuth.getCurrentSession({sessionToken:actor.token});assert.equal(resolveOperatorAccessMode(current.roleAssignments),'unassigned');
    await assert.rejects(f.services.originalWorkspaceAdministration.resolve({token:actor.token,workspacePathSegment:'1',write:false}));
    await assert.rejects(f.services.adminDirectory.listAdminUsers({sessionToken:actor.token}),e=>e.statusCode===403);
   }
  }finally{await f.repository.saveAdminRoleAssignment(valid);}
 });
 await t.test('a canonical workspace grant replaces opaque membership, and later revocation cannot resurrect it',async()=>{
  await f.setUsers({u:[{id:2,role:'XX'}]});
  const before=(await f.repository.listAdminRoleAssignmentsByUserId(f.a.adminUserId)).find(r=>r.workspaceId===f.one.workspaceId);
  const result=await f.services.adminDirectory.assignAdminRole({sessionToken:f.root.token,adminUserId:f.a.adminUserId,role:'workspace_admin',tenantKey:f.tenant.tenantKey,workspaceKey:f.one.workspaceKey});
  const rows=result.roleAssignments.filter(r=>r.workspaceId===f.one.workspaceId);assert.equal(rows.length,1);assert.equal(rows[0].roleAssignmentId,before.roleAssignmentId);assert.equal(rows[0].role,'workspace_admin');assert.equal(rows[0].nativeWorkspaceRole,undefined);
  assert.equal(JSON.parse(await f.users()).find(r=>r.id===2).role,'RW');
  await f.services.adminDirectory.revokeAdminRole({sessionToken:f.root.token,adminUserId:f.a.adminUserId,roleAssignmentId:rows[0].roleAssignmentId});await f.reopen();
  assert.equal(JSON.parse(await f.users()).find(r=>r.id===2).selected,false);
  await assert.rejects(f.services.originalWorkspaceAdministration.resolve({token:actor.token,workspacePathSegment:'1',write:false}),e=>e.statusCode===404);
 });
 await t.test('the canonical role API cannot create an internal opaque role kind',async()=>{
  await assert.rejects(f.services.adminDirectory.assignAdminRole({sessionToken:f.root.token,adminUserId:f.a.adminUserId,role:'native_workspace_opaque',tenantKey:f.tenant.tenantKey,workspaceKey:f.one.workspaceKey}),e=>e.statusCode===400);
 });
});
