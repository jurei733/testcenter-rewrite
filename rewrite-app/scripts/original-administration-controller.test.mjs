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
  assert.deepEqual(f.controller.workspaces.map(w=>w.tenantKey),["b","a"]);
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
  assert.equal(f.controller.workspaces.at(-1).tenantKey,originalAdministrationTenantKey);
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
