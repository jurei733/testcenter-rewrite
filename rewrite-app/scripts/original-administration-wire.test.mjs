import assert from 'node:assert/strict';
import test from 'node:test';
import {administrationModule} from './original-administration-test-loader.mjs';
import {verifyOpaqueRoleEvidence} from '../test-fixtures/original-testcenter/source-workspace-results/native-administration-opaque-role-http/verify.mjs';
const {parseOriginalAdministrationWire:parse,originalAdministrationPermissionBody:body}=administrationModule('original-administration-wire');
const {createOriginalAdministrationTransport:create}=administrationModule('original-administration-http');
test('the frozen real Source HTTP preserves selected empty roles in both matrix directions',async()=>{
 assert.equal((await verifyOpaqueRoleEvidence()).selectedEmptyOpaqueMembershipRetained,true);
});
for(const path of ['/users','/workspaces','/user/1/workspaces','/workspace/1/users'])test('native administration lossless directory '+path,()=>{
 const fields=path==='/users'?',"email":null,"isSuperadmin":true':path==='/workspaces'?',"latest_modification_ts":null':',"selected":true,"role":"custom Ω"';
 const rows=parse(path,'[{"id":9007199254740993,"name":"same"'+fields+'},{"id":9223372036854775807,"name":"same"'+fields+'}]');
 assert.deepEqual(rows.map(r=>r.id),['9007199254740993','9223372036854775807']);assert.equal(rows[0].name,rows[1].name);
 for(const id of ['"1"','0','-1','1.5','1e0','9223372036854775808'])assert.throws(()=>parse(path,'[{"id":'+id+',"name":"bad"'+fields+'}]'),id);
 assert.throws(()=>parse(path,'[{"id":1,"name":"same"'+fields+'},{"id":1,"name":"same"'+fields+'}]'));
});
test('native self identity is numeric while workspace claim identities remain strings',()=>{
 const value=parse('/session','{"id":9007199254740993,"token":"owned","claims":{"superAdmin":[],"workspaceAdmin":[{"id":"9223372036854775807","type":"workspaceAdmin"}]}}');
 assert.equal(value.id,'9007199254740993');assert.equal(value.claims.workspaceAdmin[0].id,'9223372036854775807');
 assert.throws(()=>parse('/session','{"id":"1","token":"owned","claims":{"superAdmin":[],"workspaceAdmin":[]}}'));
});
test('complete matrix body preserves unknown and selected-empty opaque memberships and clears unselected rows',()=>{
 assert.deepEqual(body([{id:'9007199254740993',selected:true,role:'',name:'a'},{id:'2',selected:true,role:'OTHER',name:'b'},{id:'3',selected:false,role:'',name:'c'}]),[
  {id:'9007199254740993',role:'\0'},{id:'2',role:'OTHER'},{id:'3',role:''}]);
});
for(const [status,text,code]of [[403,'Invalid password for user 1','admin_password_confirmation_invalid'],[403,'Invalid current password for user 1','admin_password_confirmation_invalid'],[403,'Invalid token.','original_admin_session_invalid'],[403,'Only SuperAdmins can do that!','original_administration_failed'],[500,'owned secret','original_administration_failed']])test('owned administration error '+text,async()=>{
 const request=create(async()=>new Response(text,{status}));
 await assert.rejects(request('DELETE','/users',{u:['2'],p:'password'},'owned secret',new AbortController().signal),e=>e.error===code&&e.statusCode===status&&!e.message.includes('owned secret'));
});
test('native transport sends captured headers/body, preserves huge creation IDs and only accepts password rotation headers',async()=>{
 let call;const request=create(async(path,init)=>{call={path,...init};return new Response('9007199254740993',{status:201});});
 assert.equal((await request('PUT','/workspace',{name:'raw name '},'owned',new AbortController().signal)).value,'9007199254740993');
 assert.equal(call.headers.AuthToken,'owned');assert.equal(call.headers.authorization,undefined);assert.equal(call.cache,'no-store');assert.equal(call.credentials,'omit');assert.equal(call.redirect,'error');assert.equal(call.body,'{"name":"raw name "}');
 const rotated=create(async()=>new Response('',{headers:{AuthToken:'new-owned'}}));
 assert.equal((await rotated('PATCH','/user/1/password',{p:'new'},'old',new AbortController().signal)).authToken,'new-owned');
 await assert.rejects(rotated('PATCH','/user/1/workspaces',{ws:[]},'old',new AbortController().signal));
 for(const path of ['https://foreign.invalid/users','/api/v1/admin/users','/users?next=foreign','/user/../workspaces'])await assert.rejects(request('GET',path,undefined,'owned',new AbortController().signal));
});
test('retired transport cannot acknowledge a response or start a request',async()=>{
 const owner=new AbortController();let release,calls=0;const waiting=new Promise(done=>release=done);
 const request=create(async()=>{calls++;await waiting;return new Response('[]');});const pending=request('GET','/users',undefined,'owned',owner.signal);
 owner.abort();release();await assert.rejects(pending);await assert.rejects(request('GET','/users',undefined,'owned',owner.signal));assert.equal(calls,1);
});
