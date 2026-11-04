import assert from 'node:assert/strict';
import test from 'node:test';
import {fixture} from './native-admin-permissions-controls.mjs';
import {sourceOpaqueRoleRow} from './source-native-opaque-workspace-roles-evidence.mjs';
import {createProductionApiServer} from '../apps/api/dist/apps/api/src/index.js';
import {productionApiRoutes,resolveRoutePath} from '@testcenter-rewrite-app/contracts';

for(const kind of ['file','sqlite',...(process.env.FIRST_SLICE_STORE==='postgres'?['postgres']:[])])test(`real ${kind} HTTP preserves opaque native roles and denies canonical/native access`,{timeout:120000},async t=>{
 const f=await fixture(kind,t);await f.repository.saveAdminUser({...f.a,passwordChangeRequired:false});
 const actor=await f.services.originalAdminSession.login({name:f.a.username,password:f.password});
 const environment={FIRST_SLICE_STORE:kind,FIRST_SLICE_FILE:f.file,FIRST_SLICE_SQLITE_FILE:f.file,...f.url?{FIRST_SLICE_POSTGRES_URL:f.url.toString()}:{},FIRST_SLICE_BOOTSTRAP_DEMO:'false',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_PROOF_OF_WORK_SCOPES:''};
 let server,base;
 const start=async()=>{
  const previous=new Map(Object.keys(environment).map(k=>[k,process.env[k]]));
  try{Object.assign(process.env,environment);server=await createProductionApiServer();}finally{for(const[k,v]of previous)if(v===undefined)delete process.env[k];else process.env[k]=v;}
  await new Promise(done=>server.listen(0,'127.0.0.1',done));base='http://127.0.0.1:'+server.address().port;
 };
 const stop=async()=>{if(!server)return;const previous=server;server=undefined;previous.closeAllConnections();await new Promise(done=>previous.close(done));};
 f.beforeShutdown(stop);
 if(kind==='file')await f.releaseStorage();await start();
 const request=async(method,path,{token=f.root.token,body,canonical=false,raw}={})=>{
  const response=await fetch(base+path,{method,headers:{...(canonical?{authorization:'Bearer '+token}:{AuthToken:token}),...(body===undefined&&raw===undefined?{}:{'content-type':'application/json'})},...(raw!==undefined?{body:raw}:body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
  return{status:response.status,text:await response.text(),headers:response.headers};
 };
 const scoped='/api/v1/tenants/'+f.tenant.tenantKey+'/workspaces/'+f.one.workspaceKey;
 for(const name of ['opaque','padded','limit-unicode','nul-only','over-limit-spaces','over-limit-trailing-spaces','RO','RW','RW-nul-suffix','blank']){
  await t.test(name+' actual permission write, projection and both authority models',async()=>{
   // File's single-writer protocol is preserved. Transfer ownership between
   // fixture setup and the actual server rather than opening a second writer.
   if(kind==='file'){await stop();await f.reopen();}
   const group='OWNED.OPAQUE.ROLE.NO.RESULTS';await f.repository.getOrCreateOriginalParticipantGroup({tenantId:f.tenant.tenantId,workspaceId:f.one.workspaceId,groupKey:group,groupLabel:group,createdAt:f.now()});
   if(kind==='file'){await f.releaseStorage();await start();}
   const source=sourceOpaqueRoleRow('workspace-'+name+'-write'),body=source.requestBody;
   const changed=await request('PATCH','/workspace/1/users',{body});assert.equal(changed.status,200);assert.equal(changed.text,'');
   const native=await request('GET','/workspace/1/users');assert.equal(native.status,200);
   const expected=sourceOpaqueRoleRow('workspace-'+name+'-matrix').value.find(r=>r.id===2),subject=JSON.parse(native.text).find(r=>r.id===2);
   assert.deepEqual({selected:subject.selected,role:subject.role},{selected:expected.selected,role:expected.role});
   const session=await request('GET','/session',{token:actor.token});assert.equal(session.status,200);assert.equal(JSON.parse(session.text).claims.workspaceAdmin.find(r=>r.id==='1')?.flags.mode,expected.selected?expected.role:undefined);
   const read=await request('GET','/workspace/1/results',{token:actor.token});assert.equal(read.status,sourceOpaqueRoleRow('workspace-'+name+'-read').status);
   if(read.status===403)assert.equal(read.text,sourceOpaqueRoleRow('workspace-'+name+'-read').rawText);
   const canonicalRead=await request('GET',scoped+'/source-packages',{token:actor.token,canonical:true});
   assert.equal(canonicalRead.status,expected.selected&&(expected.role==='RO'||expected.role==='RW')?200:403);
   // The real positive write has an owned group. Rejected writes must retain
   // it unchanged, including when the unauthorized body is malformed.
   const deletion=await request('DELETE','/workspace/1/responses',{token:actor.token,body:{groups:[group]}});
   assert.equal(deletion.status,sourceOpaqueRoleRow('workspace-'+name+'-delete').status);
   if(deletion.status===403)assert.equal(deletion.text,sourceOpaqueRoleRow('workspace-'+name+'-delete').rawText);
   if(expected.selected&&expected.role!=='RO'&&expected.role!=='RW'){
    assert.equal((await request('DELETE','/workspace/1/responses',{token:actor.token,raw:'{'})).status,403);
    assert.equal((await request('GET','/api/v1/admin/users',{token:actor.token,canonical:true})).status,403);
   }
   if(kind==='file'){await stop();await f.reopen();}
   const groups=await f.repository.listOriginalParticipantGroupsByWorkspace(f.tenant.tenantId,f.one.workspaceId);assert.equal(groups.some(r=>r.groupKey===group),deletion.status!==200);
  });
 }
 await t.test('canonical HTTP regrant replaces the opaque row and rejects the internal kind as input',async()=>{
  if(kind==='file'){await f.releaseStorage();await start();}
  assert.equal((await request('PATCH','/workspace/1/users',{body:{u:[{id:2,role:'XX'}]}})).status,200);
  const route=resolveRoutePath(productionApiRoutes.admin.assignRole,{adminUserId:f.a.adminUserId});
  assert.equal((await request('POST',route,{canonical:true,body:{role:'native_workspace_opaque',tenantKey:f.tenant.tenantKey,workspaceKey:f.one.workspaceKey}})).status,400);
  const grant=await request('POST',route,{canonical:true,body:{role:'workspace_admin',tenantKey:f.tenant.tenantKey,workspaceKey:f.one.workspaceKey}});assert.equal(grant.status,200);
  const rows=JSON.parse(grant.text).roleAssignments.filter(r=>r.workspaceId===f.one.workspaceId);assert.equal(rows.length,1);assert.equal(rows[0].role,'workspace_admin');assert.equal(rows[0].nativeWorkspaceRole,undefined);
  assert.equal((await request('GET',scoped+'/source-packages',{token:actor.token,canonical:true})).status,200);
  const revoke=resolveRoutePath(productionApiRoutes.admin.revokeRole,{adminUserId:f.a.adminUserId,roleAssignmentId:rows[0].roleAssignmentId});
  assert.equal((await request('DELETE',revoke,{canonical:true,body:{}})).status,200);
  assert.equal(JSON.parse((await request('GET','/workspace/1/users')).text).find(r=>r.id===2).selected,false);
 });
 await t.test('another real RW workspace remains usable while this opaque scope stays forbidden in both APIs',async()=>{
  assert.equal((await request('PATCH','/user/2/workspaces',{body:{ws:[{id:1,role:'XX'},{id:2,role:'RW'}]}})).status,200);
  const other='/api/v1/tenants/'+f.tenant.tenantKey+'/workspaces/'+f.two.workspaceKey;
  assert.equal((await request('GET',other+'/source-packages',{token:actor.token,canonical:true})).status,200);
  assert.equal((await request('GET',scoped+'/source-packages',{token:actor.token,canonical:true})).status,403);
  assert.equal((await request('GET','/workspace/2/results',{token:actor.token})).status,200);
  assert.equal((await request('GET','/workspace/1/results',{token:actor.token})).status,403);
  assert.equal((await request('DELETE','/workspace/1/responses',{token:actor.token,body:{groups:['OWNED.OPAQUE.ROLE.NO.RESULTS']}})).status,403);
  assert.equal((await request('PATCH','/workspace/1/users',{body:{u:[{id:2,role:'XX'}]}})).status,200);
  assert.equal((await request('GET',other+'/source-packages',{token:actor.token,canonical:true})).status,200);
  assert.equal((await request('PATCH','/user/2/workspaces',{body:{ws:[{id:1,role:'RO'}]}})).status,200);
  assert.equal((await request('GET',other+'/source-packages',{token:actor.token,canonical:true})).status,403);
  assert.equal((await request('GET','/workspace/2/results',{token:actor.token})).status,404);
 });
});
