import './original-administration-wire.test.mjs';
import './original-administration-input.test.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {administrationModule} from './original-administration-test-loader.mjs';
const {OriginalAdministrationController:Controller}=administrationModule('original-administration-controller');
const defer=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const users=[{id:'1',name:'root',email:null,isSuperadmin:true},{id:'9007199254740993',name:'duplicate',email:null,isSuperadmin:false},{id:'3',name:'duplicate',email:null,isSuperadmin:false}];
const workspaces=[{id:'9007199254740995',name:'same',latest_modification_ts:null},{id:'2',name:'same',latest_modification_ts:'2026-11-04 12:13:14'},{id:'4',name:'opaque',latest_modification_ts:null}];
const permission=(id,role='',selected=!!role)=>({id,name:'same',role,selected});
function fixture(handler=()=>{}){
 const session={token:'owned-token'},calls=[],changed=[];let userMatrix=workspaces.map(w=>permission(w.id)),workspaceMatrix=users.map(u=>permission(u.id));
 const c=new Controller(async(method,path,body,token,signal)=>{
  const call={method,path,body,token,signal};calls.push(call);const result=await handler(call);
  if(result!==undefined)return result;
  const value=path==='/session'?{id:'1',token,claims:{superAdmin:[],workspaceAdmin:[]}}:path==='/users'?users.map(u=>({...u})):path==='/workspaces'?workspaces.map(w=>({...w})):
   method==='GET'&&path.endsWith('/workspaces')?userMatrix.map(r=>({...r})):method==='GET'&&path.endsWith('/users')?workspaceMatrix.map(r=>({...r})):undefined;
  return {value};
 },()=>session,()=>changed.push(true),(previous,next)=>{if(session.token!==previous)return false;session.token=next;return true;});
 return {c,session,calls,changed,setUserMatrix:r=>userMatrix=r,setWorkspaceMatrix:r=>workspaceMatrix=r,connect:()=>c.connect(session.token)};
}
test('connect uses only native numeric directories and native current self, independent of duplicate names',async()=>{
 const f=fixture();assert.equal(await f.connect(),true);assert.equal(f.c.selfId,'1');assert.deepEqual(f.c.admins,users);assert.deepEqual(f.c.workspaces,workspaces);
 assert.deepEqual(f.calls.map(x=>x.path),['/session','/users','/workspaces']);assert.equal(f.c.admins[1].name,f.c.admins[2].name);
});
for(const direction of ['users','workspaces'])test(direction+': one complete save preserves opaque/raw grants and retry is atomic',async()=>{
 let fail=true;const f=fixture(call=>{if(call.method==='PATCH'&&fail)throw {error:'owned_write_failure'};});
 const basis=direction==='users'?[permission(workspaces[0].id,'RO'),permission('2','OTHER'),permission('4','',true)]:[permission('1','RO'),permission(users[1].id,'OTHER'),permission('3','',true)];
 direction==='users'?f.setUserMatrix(basis):f.setWorkspaceMatrix(basis);await f.connect();
 const select=()=>direction==='users'?f.c.selectAdmin(users[1].id):f.c.selectWorkspace(workspaces[0].id);await select();
 const row=f.c.permissionRows(direction)[0];f.c.togglePermissionRow(row,'RW');const before=[...f.c.changes];
 assert.equal(await f.c.savePermissions(),false);assert.deepEqual([...f.c.changes],before);fail=false;assert.equal(await f.c.savePermissions(),true);
 const writes=f.calls.filter(c=>c.method==='PATCH');assert.equal(writes.length,2);assert.deepEqual(writes[0].body,writes[1].body);
 assert.deepEqual(Object.values(writes[1].body)[0],basis.map((r,i)=>({id:r.id,role:i===0?'RW':r.selected&&r.role===''?'\0':r.role})));
 assert.equal(f.c.changes.size,0);const reads=f.calls.length;await select();assert.equal(f.calls.length,reads,'Same selection preserves current matrix/focus.');
});
test('last grant can be cleared with a nonempty complete matrix instead of invalid empty selection body',async()=>{
 const f=fixture();f.setUserMatrix(workspaces.map((w,i)=>permission(w.id,i===0?'RO':'')));await f.connect();await f.c.selectAdmin(users[1].id);
 f.c.togglePermissionRow(f.c.permissionRows('users')[0],'RO');assert.equal(await f.c.savePermissions(),true);
 assert.deepEqual(f.calls.at(-1).body,{ws:workspaces.map(w=>({id:w.id,role:''}))});
});
for(const section of ['users','workspaces'])test(section+': selecting the same row retries a failed matrix GET',async()=>{
 let reads=0;const path=section==='users'?'/user/'+users[1].id+'/workspaces':'/workspace/'+workspaces[0].id+'/users';
 const f=fixture(call=>{if(call.method==='GET'&&call.path===path&&++reads===1)throw Error('Owned transient matrix failure.');});
 await f.connect();const select=()=>section==='users'?f.c.selectAdmin(users[1].id):f.c.selectWorkspace(workspaces[0].id);
 assert.equal(await select(),false);assert.deepEqual(f.c.permissionRows(section),[]);
 assert.equal(await select(),true);assert.equal(reads,2);assert.ok(f.c.permissionRows(section).length>0);assert.equal(f.c.problem,'');
});
for(const section of ['users','workspaces'])test(section+': retained visual rows cannot stage or write after clear, old row cannot edit new subject',async()=>{
 const f=fixture();await f.connect();await(section==='users'?f.c.selectAdmin(users[1].id):f.c.selectWorkspace(workspaces[0].id));
 const row=f.c.permissionRows(section)[1];f.c.togglePermissionRow(row,'RW');const expected=f.c.permissionRows(section),epoch=f.c.permissionViewEpoch;
 f.c.clearSelection();assert.deepEqual(f.c.permissionRows(section),expected);assert.equal(f.c.permissionViewEpoch,epoch);
 const retained=f.c.permissionRows(section)[1];f.c.togglePermissionRow(retained,'RO');assert.equal(retained.access,'');assert.equal(f.c.changes.size,0);assert.equal(await f.c.savePermissions(),false);
 await(section==='users'?f.c.selectAdmin('3'):f.c.selectWorkspace('2'));f.c.togglePermissionRow(retained,'RW');assert.equal(f.c.changes.size,0);
 f.c.clearSelection(false);assert.deepEqual(f.c.permissionRows(section),[]);
});
test('retired matrix read cannot populate cleared selection or a replacement session',async()=>{
 const d=defer();let hold=true;const f=fixture(call=>hold&&call.path.endsWith('/workspaces')&&call.path!=='/workspaces'?d.promise:undefined);await f.connect();
 const old=f.c.selectAdmin(users[1].id);f.c.clearSelection(false);hold=false;f.session.token='replacement';await f.connect();d.resolve({value:[permission('2','RW')]});
 assert.equal(await old,false);assert.deepEqual(f.c.permissionRows('users'),[]);assert.equal(f.c.busy,false);assert.equal(f.c.problem,'');
});
for(const retire of ['replace','destroy'])test('retired permission acknowledgement '+retire+' cannot clear/populate the current actor',async()=>{
 const d=defer();const f=fixture(call=>call.method==='PATCH'?d.promise:undefined);await f.connect();await f.c.selectAdmin(users[1].id);f.c.togglePermissionRow(f.c.permissionRows('users')[0],'RO');
 const saved=f.c.savePermissions();if(retire==='replace'){f.session.token='next';await f.connect();}else f.c.destroy();d.resolve({value:undefined});
 assert.equal(await saved,false);assert.deepEqual(f.c.permissionRows('users'),[]);assert.equal(f.c.changes.size,0);assert.equal(f.c.busy,false);
});
test('all native CRUD actions use exact IDs and complete Source payloads, reload only after acknowledgement',async()=>{
 const f=fixture();await f.connect();
 for(const action of [()=>f.c.createUser(' raw user ','pw'),()=>f.c.createWorkspace(' raw workspace '),()=>f.c.renameWorkspace(workspaces[0].id,'new name'),()=>f.c.resetPassword(users[1].id,'new pw'),()=>f.c.changeSuperadmin(users[1].id,'root pw'),()=>f.c.deleteUser('3','root pw'),()=>f.c.deleteWorkspace('2','root pw')])assert.equal(await action(),true);
 assert.deepEqual(f.calls.filter(c=>c.method!=='GET').map(({method,path,body})=>({method,path,body})),[
  {method:'PUT',path:'/user',body:{n:' raw user ',p:'pw'}},{method:'PUT',path:'/workspace',body:{name:' raw workspace '}},{method:'PATCH',path:'/workspace/9007199254740995',body:{name:'new name'}},
  {method:'PATCH',path:'/user/9007199254740993/password',body:{p:'new pw'}},{method:'PATCH',path:'/user/9007199254740993/super-admin/on',body:{p:'root pw'}},
  {method:'DELETE',path:'/users',body:{u:['3'],p:'root pw'}},{method:'DELETE',path:'/workspaces',body:{ws:['2'],p:'root pw'}}
 ]);
 const n=f.calls.length;assert.equal(await f.c.deleteUser('1','pw'),false);assert.equal(await f.c.changeSuperadmin('1','pw'),false);assert.equal(await f.c.deleteWorkspace('foreign-uuid','pw'),false);assert.equal(f.calls.length,n);
});
test('a committed creation with failed directory reload is acknowledged and never repeated automatically',async()=>{
 let fail=false;const f=fixture(call=>{if(fail&&call.path==='/users'&&call.method==='GET')throw Error('read failed');});await f.connect();fail=true;
 assert.equal(await f.c.createUser('new user','pw'),true);assert.equal(f.c.problemCode,'original_directory_refresh_failed');assert.equal(f.calls.filter(c=>c.method==='PUT').length,1);
});
test('self password rotation adopts only the still-current actor, retains native identity and uses the new token next',async()=>{
 const f=fixture(call=>call.path==='/user/1/password'?{value:undefined,authToken:'renewed'}:undefined);await f.connect();
 assert.equal(await f.c.resetPassword('1','new pw','old pw'),true);assert.equal(f.session.token,'renewed');assert.equal(f.c.selfId,'1');assert.equal(f.c.busy,false);
 assert.deepEqual(f.calls.at(-1).body,{p:'new pw',oldPassword:'old pw'});await f.c.selectAdmin('3');assert.equal(f.calls.at(-1).token,'renewed');
});
test('late self-password response cannot overwrite a replacement bearer',async()=>{
 const d=defer();const f=fixture(call=>call.path==='/user/1/password'?d.promise:undefined);await f.connect();
 const pending=f.c.resetPassword('1','new','old');f.session.token='replacement';await f.connect();d.resolve({value:undefined,authToken:'old-actor-renewed'});
 assert.equal(await pending,false);assert.equal(f.session.token,'replacement');assert.equal(f.c.busy,false);
});
const reference=JSON.parse(readFileSync(new URL('./fixtures/original-administration-permissions.json',import.meta.url),'utf8'));
test('a queued event from an old matrix cannot edit a reselected identical native owner',async()=>{
 const f=fixture();await f.connect();await f.c.selectAdmin(users[1].id);const row=f.c.permissionRows('users')[0];
 f.c.clearSelection();await f.c.selectAdmin(users[1].id);f.c.togglePermissionRow(row,'RW');assert.equal(f.c.changes.size,0);
});
for(const mutation of ['rename-workspace','change-superadmin'])for(const outcome of ['acknowledged','rejected','retired'])test(mutation+' '+outcome+' preserves Source visual rows and exact ownership',async()=>{
 const d=defer();const f=fixture(call=>call.method==='PATCH'?d.promise:undefined);await f.connect();await f.c.selectAdmin(users[1].id);
 f.c.togglePermissionRow(f.c.permissionRows('users')[0],'RW');const before=f.c.permissionRows('users');
 const action=mutation==='rename-workspace'?f.c.renameWorkspace(workspaces[0].id,'new label'):f.c.changeSuperadmin(users[1].id,'owned confirmation');
 if(outcome==='retired'){f.session.token='next';await f.connect();}
 if(outcome==='rejected')d.reject({error:'admin_password_confirmation_invalid'});else d.resolve({value:undefined});
 assert.equal(await action,outcome==='acknowledged');
 if(outcome==='acknowledged'){assert.equal(f.c.selectedAdminId,'');assert.deepEqual(f.c.permissionRows('users'),before);assert.equal(f.c.changes.size,0);}
 else if(outcome==='rejected'){assert.equal(f.c.selectedAdminId,users[1].id);assert.deepEqual(f.c.permissionRows('users'),before);assert.equal(f.c.changes.size,1);assert.equal(f.c.problem,'Falsches Kennwort.');}
 else {assert.deepEqual(f.c.permissionRows('users'),[]);assert.equal(f.c.changes.size,0);}
 assert.ok(!JSON.stringify(f.c).includes('owned confirmation'));
});
for(const captured of reference.sources){
 const exports={};new Function('exports',ts.transpileModule('export class Source {'+captured.handler+'}',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)(exports);
 for(const saved of ['','RO','RW','OTHER'])for(const control of ['RO','RW'])test(captured.path+': native checkbox '+saved+' '+control+' uses actual Source handler',async()=>{
  const f=fixture(),row={role:saved},oracle=new exports.Source();f.setUserMatrix(workspaces.map(w=>permission(w.id,saved)));await f.connect();await f.c.selectAdmin(users[1].id);
  oracle.selectPermissions(row,control);f.c.togglePermission(users[1].id,workspaces[0].id,control);assert.equal(f.c.access(users[1].id,workspaces[0].id),row.role);
 });
}
