import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { productionApiRoutes, resolveRoutePath } from "@testcenter-rewrite-app/contracts";

const url = new URL("../apps/web/src/app/original-administration-controller.ts",import.meta.url);
const source = ts.createSourceFile("controller.ts",readFileSync(url,"utf8"),ts.ScriptTarget.Latest,true);
const code = source.statements.filter(node=>!ts.isImportDeclaration(node)).map(node=>node.getText(source)).join("\n");
const exports = {};
new Function("exports","productionApiRoutes","resolveRoutePath","crypto",ts.transpileModule(code,{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
}).outputText)(exports,productionApiRoutes,resolveRoutePath,globalThis.crypto);
const { OriginalAdministrationController: Controller, originalAdministrationTenantKey } = exports;
const defer = () => {let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const admin = (id="other", assignments=[]) => ({adminUser:{adminUserId:id,username:id},roleAssignments:assignments});
const workspace = (id="ws-a",tenant="a") => ({workspaceId:id,workspaceKey:id,tenantId:tenant,tenantKey:tenant,displayName:id,latestFileModificationAt:null});
const role = (accessMode="read_only",id="ws-a") => ({roleAssignmentId:"role-"+id,role:"workspace_admin",workspaceId:id,accessMode});
const fixture = handler => {
  const session={token:"owned-token",adminUserId:"self"},calls=[],changed=[];
  const controller=new Controller(async(method,path,body,token)=>{
    const call={method,path,body,token};calls.push(call);return handler(call);
  },()=>session,()=>changed.push(true),()=>"owned-workspace-key");
  controller.token=session.token;
  controller.admins=[admin("self"),admin()];controller.workspaces=[workspace(),workspace("ws-b","b")];
  return {controller,session,calls,changed};
};

// CI independently verifies both captured methods against the unchanged pinned
// Original checkout before producing its browser build. Ordinary unit jobs need
// no unrelated checkout or network access to execute that real Source method.
const sourceReference=JSON.parse(readFileSync(new URL("./fixtures/original-administration-permissions.json",import.meta.url),"utf8"));
for (const owner of ['admin','workspace']) test(`selecting the same ${owner} again retains the Source permission draft without a reload`,()=>{
 const f=fixture(()=>{throw Error('Selection must not dispatch a write');});
 f.controller.admins=[admin('self'),admin('other',[role()])];
 const select=id=>owner==='admin'?f.controller.selectAdmin(id):f.controller.selectWorkspace(id);
 const id=owner==='admin'?'other':'ws-a';select(id);
 f.controller.togglePermission('other','ws-a','RW');
 const draft=[...f.controller.changes],changes=f.changed.length,epoch=f.controller.permissionViewEpoch;select(id);
 assert.deepEqual([...f.controller.changes],draft);assert.equal(f.controller.access('other','ws-a'),'RW');
 assert.equal(f.changed.length,changes);assert.deepEqual(f.calls,[]);
 assert.equal(f.controller.permissionViewEpoch,epoch,'Repeated selection keeps the existing focused row.');
 select(owner==='admin'?'self':'ws-b');assert.equal(f.controller.changes.size,0);
 assert.equal(f.controller.access('other','ws-a'),'RO');
});
for (const section of ['users','workspaces']) test(`${section}: cleared selection retains visual draft rows without staging or saving them`,async()=>{
 const f=fixture(()=>{throw Error('A retained visual row has no mutation owner');});
 f.controller.admins=[admin('self'),admin('other',[role()])];
 const select=()=>section==='users'?f.controller.selectAdmin('other'):f.controller.selectWorkspace('ws-a');
 select();f.controller.togglePermission('other','ws-a','RW');
 const expected=f.controller.permissionRows(section),epoch=f.controller.permissionViewEpoch;f.controller.clearSelection();
 assert.equal(f.controller.permissionViewEpoch,epoch,'Clearing selection retains the actual permission view.');
 assert.deepEqual(f.controller.permissionRows(section),expected);assert.equal(f.controller.changes.size,0);
 const row=f.controller.permissionRows(section).find(row=>row.adminUserId==='other'&&row.workspaceId==='ws-a');
 assert.equal(row.access,'RW');f.controller.togglePermissionRow(row,'RO');assert.equal(row.access,'');
 assert.equal(f.controller.changes.size,0);assert.equal(await f.controller.savePermissions(),false);assert.deepEqual(f.calls,[]);
 select();assert.equal(f.controller.permissionRows(section).find(row=>row.adminUserId==='other'&&row.workspaceId==='ws-a').access,'RO');
 assert.equal(f.controller.permissionViewEpoch,epoch+1,'Selecting the owner again creates fresh Source permission rows.');
 if(section==='users')f.controller.selectAdmin('self');else f.controller.selectWorkspace('ws-b');
 f.controller.togglePermissionRow(row,'RW');assert.equal(f.controller.changes.size,0,'An old row cannot stage rights for the newly selected owner.');
 f.controller.clearSelection(false);assert.deepEqual(f.controller.permissionRows(section),[]);
});
test('a replacement session and destruction clear every retained permission label and draft',async()=>{
 const f=fixture(call=>call.path===productionApiRoutes.admin.listUsers?{items:[admin('replacement')]}:
   call.path===productionApiRoutes.platform.listTenants?{items:[]}:{items:[]});
 f.controller.selectAdmin('other');f.controller.togglePermission('other','ws-a','RW');f.controller.clearSelection();
 assert.ok(f.controller.permissionRows('users').length);f.session.token='replacement';await f.controller.connect('replacement');
 assert.deepEqual(f.controller.permissionRows('users'),[]);assert.deepEqual(f.controller.permissionRows('workspaces'),[]);
 f.controller.admins=[admin('other')];f.controller.workspaces=[workspace()];f.controller.selectAdmin('other');
 f.controller.clearSelection();assert.ok(f.controller.permissionRows('users').length);f.controller.destroy();
 assert.deepEqual(f.controller.permissionRows('users'),[]);
});
for (const captured of sourceReference.sources) {
 const reference={};new Function("exports",ts.transpileModule(`export class Source {${captured.handler}}`,{
   compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
 }).outputText)(reference);
 for (const saved of ["","RO","RW"]) for (const checkbox of ["RO","RW"]) {
  test(`${captured.path}: permission ${saved||"none"} + ${checkbox} matches the pinned Original's actual checkbox handler`,()=>{
    const f=fixture(()=>{}),row={role:saved},oracle=new reference.Source();
    f.controller.admins=[admin("other",saved?[role(saved==="RO"?"read_only":"read_write")]:[])];
    oracle.selectPermissions(row,checkbox);f.controller.togglePermission("other","ws-a",checkbox);
    assert.equal(f.controller.access("other","ws-a"),row.role);
    oracle.selectPermissions(row,checkbox);f.controller.togglePermission("other","ws-a",checkbox);
    assert.equal(f.controller.access("other","ws-a"),row.role);
    assert.equal(f.controller.changes.size,row.role===saved?0:1);
  });
 }
}

test("loading the flat directory keeps every workspace's real tenant and ignores late retired-session reads",async()=>{
  const first=defer();const f=fixture(call=>{
    if(call.path===productionApiRoutes.admin.listUsers)return call.token==="owned-token"?first.promise:{items:[admin("replacement")]};
    if(call.path===productionApiRoutes.platform.listTenants)return {items:[{tenantKey:"b",tenantId:"b"},{tenantKey:"a",tenantId:"a"}]};
    return {items:[workspace(call.path.includes('/b/')?"b":"a")]};
  });
  const old=f.controller.connect("owned-token");
  f.session.token="new-token";await f.controller.connect("new-token");
  first.resolve({items:[admin("old-private-directory")]});assert.equal(await old,false);
  assert.deepEqual(f.controller.admins.map(a=>a.adminUser.username),["replacement"]);
  assert.deepEqual(f.controller.workspaces.map(w=>w.tenantKey),["a","b"]);
  assert.equal(f.controller.busy,false);assert.equal(f.controller.problem,"");
  assert.ok(f.calls.filter(c=>c.path.includes('/workspaces')).every(c=>c.token==="new-token"));
});

test("a failed permission batch retains only unacknowledged rows and retries only those rows",async()=>{
  let fail=true;const f=fixture(call=>{
    if(call.body.workspaceKey==="ws-b"&&fail)throw {error:"owned_failure"};
    const old=f.controller.admins.find(a=>a.adminUser.adminUserId==="other");
    return admin("other",[...old.roleAssignments,role(call.body.accessMode,call.body.workspaceKey)]);
  });
  f.controller.togglePermission("other","ws-a","RO");f.controller.togglePermission("other","ws-b","RW");
  assert.equal(await f.controller.savePermissions(),false);
  assert.equal(f.controller.changes.size,1);assert.equal(f.controller.access("other","ws-a"),"RO");
  assert.equal(f.controller.access("other","ws-b"),"RW");
  fail=false;assert.equal(await f.controller.savePermissions(),true);
  assert.deepEqual(f.calls.map(c=>[c.body.tenantKey,c.body.workspaceKey,c.body.accessMode]),
    [["a","ws-a","read_only"],["b","ws-b","read_write"],["b","ws-b","read_write"]]);
  assert.equal(f.controller.changes.size,0);
});

test("session replacement during a permission acknowledgement prevents the next write and any stale update",async()=>{
  const pending=defer();const f=fixture(()=>pending.promise);
  f.controller.togglePermission("other","ws-a","RW");f.controller.togglePermission("other","ws-b","RW");
  const save=f.controller.savePermissions();f.controller.destroy();f.session.token="replacement";
  pending.resolve(admin("old-private-user",[role("read_write")]));assert.equal(await save,false);
  assert.equal(f.calls.length,1);assert.deepEqual(f.controller.admins,[]);assert.deepEqual(f.controller.workspaces,[]);
  assert.equal(f.controller.problem,"");assert.equal(f.controller.notice,"");
});

test("permission removal deletes the exact assignment while leaving unrelated roles intact",async()=>{
  const f=fixture(()=>admin("other",[{role:"study_monitor",roleAssignmentId:"monitor"}]));
  f.controller.admins=[admin("other",[role(),{role:"study_monitor",roleAssignmentId:"monitor"}])];
  f.controller.togglePermission("other","ws-a","RO");assert.equal(await f.controller.savePermissions(),true);
  assert.equal(f.calls[0].method,"DELETE");assert.ok(f.calls[0].path.endsWith('/role-assignments/role-ws-a'));
  assert.deepEqual(f.controller.admins[0].roleAssignments,[{role:"study_monitor",roleAssignmentId:"monitor"}]);
});

test("workspace creation uses its dedicated container, never the last selected tenant",async()=>{
  const f=fixture(call=>call.path===productionApiRoutes.platform.createTenant
    ?{tenant:{tenantId:"owned-original",tenantKey:originalAdministrationTenantKey,status:"active"}}
    :{workspace:{...workspace("new","owned-original"),displayName:call.body.displayName}});
  f.controller.tenants=[{tenantKey:"unrelated-active-study",status:"active"}];
  assert.equal(await f.controller.createWorkspace("  Neuer Bereich  "),true);
  assert.equal(f.calls[0].body.tenantKey,originalAdministrationTenantKey);
  assert.equal(f.calls[1].path,`/api/v1/tenants/${originalAdministrationTenantKey}/workspaces`);
  assert.deepEqual(f.calls[1].body,{workspaceKey:"owned-workspace-key",displayName:"Neuer Bereich"});
  assert.equal(f.controller.workspaces.find(item=>item.workspaceId==="new").tenantKey,originalAdministrationTenantKey);
});

test("a concurrently created Original container is read back only on a genuine conflict",async()=>{
  const f=fixture(call=>{
    if(call.method==="POST"&&call.path===productionApiRoutes.platform.createTenant)throw {statusCode:409,error:"tenant_key_conflict"};
    if(call.method==="GET")return {items:[{tenantKey:originalAdministrationTenantKey,status:"active"}]};
    return {workspace:workspace("new")};
  });
  assert.equal(await f.controller.createWorkspace("Owned"),true);assert.equal(f.calls.length,3);
});

test("wrong confirmation passwords retain the directory and secrets are never stored in controller state",async()=>{
  const f=fixture(()=>{throw {error:"admin_password_confirmation_invalid"};});
  assert.equal(await f.controller.deleteWorkspace("ws-a","owned-secret"),false);
  assert.equal(f.controller.workspaces.length,2);assert.equal(f.controller.problem,"Falsches Kennwort.");
  assert.equal(JSON.stringify(f.controller).includes("owned-secret"),false);
  assert.equal(f.calls[0].body.confirmation,"ws-a");assert.equal(f.calls[0].token,"owned-token");
});

test("existing self-management guards remain in effect and retired sessions cannot dispatch a mutation",async()=>{
  const f=fixture(()=>{throw Error("must not dispatch");});
  assert.equal(await f.controller.deleteUser("self","secret"),false);
  assert.equal(await f.controller.changeSuperadmin("self","secret"),false);
  f.session.token="replacement";assert.equal(await f.controller.createUser("new","secret"),false);
  assert.deepEqual(f.calls,[]);
});
test("the existing API's own-password reset remains available without persisting the new secret",async()=>{
  const f=fixture(()=>admin("self"));
  assert.equal(await f.controller.resetPassword("self","own-new-secret"),true);
  assert.equal(f.calls[0].path,"/api/v1/admin/users/self/password");
  assert.equal(f.calls[0].body.password,"own-new-secret");
  assert.equal(JSON.stringify(f.controller).includes("own-new-secret"),false);
});

test("global Source name order survives cross-tenant loading, creation and rename without changing scope identity",async()=>{
 const a={...workspace("alpha-id","tenant-a"),tenantKey:"a",displayName:"alpha"};
 const b={...workspace("beta-id","tenant-b"),tenantKey:"b",displayName:"beta"};
 const z={...workspace("zeta-id","tenant-b"),tenantKey:"b",displayName:"zeta"};
 const f=fixture(call=>{
  if(call.path===productionApiRoutes.admin.listUsers)return{items:[admin("reader",[role("read_only","alpha-id")]),admin("self")]};
  if(call.path===productionApiRoutes.platform.listTenants)return{items:[{tenantKey:"b",status:"active"},{tenantKey:"a",status:"active"},{tenantKey:originalAdministrationTenantKey,status:"active"}]};
  if(call.method==="GET")return{items:call.path.includes('/b/')?[b,z]:call.path.includes('/a/')?[a]:[]};
  if(call.method==="POST"&&call.path.endsWith("/role-assignments"))return admin("reader",[role("read_write","alpha-id")]);
  if(call.method==="POST")return{workspace:{...workspace("created-id",originalAdministrationTenantKey),displayName:call.body.displayName}};
  if(call.method==="PATCH")return{workspace:{...z,displayName:call.body.displayName}};
 });
 await f.controller.connect("owned-token");
 assert.deepEqual(f.controller.workspaces.map(row=>row.displayName),["alpha","beta","zeta"]);
 assert.deepEqual(f.controller.workspaces.map(row=>row.tenantKey),["a","b","b"]);
 f.controller.selectAdmin("reader");f.controller.togglePermission("reader","alpha-id","RW");
 assert.equal(await f.controller.savePermissions(),true);
 const access=f.calls.find(call=>call.method==="POST"&&call.path.endsWith("/role-assignments"));
 assert.equal(access.path,"/api/v1/admin/users/reader/role-assignments");
 assert.deepEqual([access.body.tenantKey,access.body.workspaceKey],["a","alpha-id"]);
 f.controller.selectWorkspace("zeta-id");
 await f.controller.renameWorkspace("zeta-id","aardvark");
 assert.deepEqual(f.controller.workspaces.map(row=>row.displayName),["aardvark","alpha","beta"]);
 const renamed=f.calls.find(call=>call.method==="PATCH");assert.equal(renamed.path,"/api/v1/tenants/b/workspaces/zeta-id");
 assert.equal(f.controller.access("reader","alpha-id"),"RW");assert.equal(f.controller.changes.size,0);
 assert.equal(await f.controller.createWorkspace("aa-first"),true);
 assert.deepEqual(f.controller.workspaces.map(row=>row.displayName),["aa-first","aardvark","alpha","beta"]);
 assert.equal(f.controller.workspaces[0].tenantKey,originalAdministrationTenantKey);
});
test("a newly acknowledged administrator is inserted in Source name order while role receipts keep the same owner",async()=>{
 const f=fixture(call=>call.method==="POST"&&call.path===productionApiRoutes.admin.createUser?admin(call.body.username):admin("other",[role("read_write")]));
 assert.equal(await f.controller.createUser("aardvark","Owned-password-9!"),true);
 assert.deepEqual(f.controller.admins.map(row=>row.adminUser.username),["aardvark","other","self"]);
 f.controller.selectAdmin("other");f.controller.togglePermission("other","ws-a","RW");
 assert.equal(await f.controller.savePermissions(),true);assert.equal(f.controller.selectedAdminId,"other");
 assert.equal(f.controller.access("other","ws-a"),"RW");assert.deepEqual(f.controller.admins.map(row=>row.adminUser.username),["aardvark","other","self"]);
});

for (const mutation of ['rename-workspace','change-superadmin']) for (const outcome of ['acknowledged','rejected','retired']) {
 test(`${mutation}: Source clears selection and drafts only after its own successful acknowledgement (${outcome})`,async()=>{
  const held=defer(),savedRoles=[role()];
  const f=fixture(call=>{
   if(call.method!=='GET')return held.promise;
   if(call.path===productionApiRoutes.admin.listUsers)return {items:[admin('self'),admin('other',savedRoles)]};
   if(call.path===productionApiRoutes.platform.listTenants)return {items:[{tenantKey:'a'},{tenantKey:'b'}]};
   return {items:[workspace(call.path.includes('/a/')?'ws-a':'ws-b')]};
  });
  f.controller.admins=[admin('self'),admin('other',savedRoles)];
  if(mutation==='rename-workspace')f.controller.selectWorkspace('ws-a');else f.controller.selectAdmin('other');
  f.controller.togglePermission('other','ws-a','RW');
  const selected=[f.controller.selectedAdminId,f.controller.selectedWorkspaceId];
  const action=mutation==='rename-workspace'?f.controller.renameWorkspace('ws-a','Zeta renamed'):
    f.controller.changeSuperadmin('other','owned-confirmation');
  assert.deepEqual([f.controller.selectedAdminId,f.controller.selectedWorkspaceId],selected);
  assert.equal(f.controller.changes.size,1);assert.equal(f.controller.busy,true);
  if(outcome==='retired'){
   f.session.token='replacement';await f.controller.connect('replacement');f.controller.selectWorkspace('ws-b');
  }
  if(outcome==='rejected')held.reject({error:'owned_rejected'});
  else held.resolve(mutation==='rename-workspace'?{workspace:{...workspace(),displayName:'Zeta renamed'}}:
    admin('other',[...savedRoles,{role:'platform_admin',roleAssignmentId:'platform'}]));
  assert.equal(await action,outcome==='acknowledged');
  assert.equal(f.calls.filter(call=>call.method!=='GET').length,1,'Discarding a draft must never submit it');
  if(outcome==='acknowledged'){
   assert.equal(f.controller.selectedAdminId,'');assert.equal(f.controller.selectedWorkspaceId,'');
   assert.equal(f.controller.changes.size,0);assert.equal(f.controller.access('other','ws-a'),'RO');
   if(mutation==='rename-workspace')assert.equal(f.controller.workspaces.find(row=>row.workspaceId==='ws-a').displayName,'Zeta renamed');
   else assert.equal(f.controller.isSuperadmin(f.controller.admins.find(row=>row.adminUser.adminUserId==='other')),true);
  }else if(outcome==='rejected'){
   assert.deepEqual([f.controller.selectedAdminId,f.controller.selectedWorkspaceId],selected);
   assert.equal(f.controller.changes.size,1);assert.equal(f.controller.access('other','ws-a'),'RW');
  }else{
   assert.equal(f.controller.selectedWorkspaceId,'ws-b');assert.equal(f.controller.selectedAdminId,'');
   assert.equal(f.controller.workspaces.find(row=>row.workspaceId==='ws-a').displayName,'ws-a');
   assert.equal(f.controller.isSuperadmin(f.controller.admins.find(row=>row.adminUser.adminUserId==='other')),false);
  }
 });
}
