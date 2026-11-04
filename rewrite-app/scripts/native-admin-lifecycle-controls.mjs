import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {types as pgTypes} from 'pg';
import {createFirstSliceServices,decodeOriginalTestLogJson} from '@testcenter-rewrite-app/application';
import {createProductionApiServer} from '../apps/api/dist/apps/api/src/index.js';
import {fixture} from './native-admin-permissions-controls.mjs';
import {verifyNativeAdminLifecycleSecurity} from './native-admin-lifecycle-security-controls.mjs';

const root=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-admin-lifecycle-http/',import.meta.url);
const bytes=await readFile(new URL('observations.json',root)),source=JSON.parse(bytes),proof=JSON.parse(await readFile(new URL('independent-verification.json',root))),manifest=JSON.parse(await readFile(new URL('manifest.json',root)));
const hash=data=>createHash('sha256').update(data).digest('hex');
assert.equal(hash(bytes),proof.observationSha256);assert.equal(source.verified,true);assert.equal(source.actualHttpExchanges,112);assert.equal(source.baselineRestored,true);
assert.equal(source.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');assert.equal(Object.keys(source.sourceHashes).length,137);
assert.deepEqual(source.sourceRuntimeBefore,source.sourceRuntimeAfter);assert.equal(source.sqlSeedsOrDaoStubs,false);
for(const[name,digest]of Object.entries(manifest.files))assert.equal(hash(await readFile(new URL(name,root))),digest);
assert.equal(hash(await readFile(new URL('verify.mjs',root))),proof.verifierSha256);
const row=label=>{const result=source.rows.find(r=>r.label===label);assert.ok(result,label);return result;};
const targetName=row('create-target').requestBody.n,readerName=row('create-reader').requestBody.n;
const kinds=['memory','file','sqlite',...(process.env.FIRST_SLICE_STORE==='postgres'?['postgres']:[])];
const bodyFor=(body,password)=>body&&typeof body==='object'&&!Array.isArray(body)?{...body,...body.p==='[owned-root-password]'?{p:password}:{}}:body;
const selected=r=>r.label.startsWith('status-')||r.label.startsWith('after-status-')||r.label==='invalid-status-before-password';
const status=expected=>error=>error.statusCode===expected;
async function prepare(f){
 assert.equal(await f.services.originalAdminDirectory.createUser({token:f.root.token,name:targetName,password:f.password}),'4');
 assert.equal(await f.services.originalAdminDirectory.createUser({token:f.root.token,name:readerName,password:f.password}),'5');
 return f.services.originalAdminSession.login({name:targetName,password:f.password});
}
async function replay(f,request){
 let cases=0;
 for(const expected of source.rows.filter(selected)){
  const actual=await request(expected.method,expected.path,bodyFor(expected.requestBody,f.password),expected.rawRequestBody);
  assert.equal(actual.status,expected.status,expected.label+': '+actual.text);cases++;
  if(expected.method==='GET')assert.deepEqual(JSON.parse(actual.text),expected.value,expected.label);
  else assert.equal(actual.text,expected.rawText,expected.label);
  if(actual.headers){assert.equal(actual.headers.get('content-type'),expected.contentType,expected.label);assert.equal(actual.headers.get('cache-control'),'private, no-store');}
 }
 assert.ok(cases>50);return cases;
}
for(const kind of kinds)test(`${kind}: native administrator lifecycle status retains Source aliases and protected authority`,{timeout:180000},async t=>{
 const f=await fixture(kind,t),targetSession=await prepare(f),target=await f.repository.getAdminUserByUsername(targetName);
 const set=(state,body={p:f.password},reference='4')=>f.services.originalAdminDirectory.setSuperadmin({token:f.root.token,reference,status:state,body});
 await t.test('actual Source status sequence and password precedence',async()=>{
  await replay(f,async(method,path,body,raw)=>{
   try{
    if(method==='GET')return{status:200,text:await f.services.originalAdminDirectory.listUsers({token:f.root.token})};
    let parsed;try{parsed=decodeOriginalTestLogJson(raw??JSON.stringify(body));}catch{return{status:500,text:'Internal error.'};}
    const match=/^\/user\/([^/]+)\/super-admin\/(.+)$/.exec(path);
    await f.services.originalAdminDirectory.setSuperadmin({token:f.root.token,reference:decodeURIComponent(match[1]),status:decodeURIComponent(match[2]),body:parsed});return{status:200,text:''};
   }catch(error){return{status:error.statusCode,text:error.message};}
  });
 });
 await t.test('live existing sessions gain and lose Root without changing any other grant',async()=>{
  const role={roleAssignmentId:randomUUID(),adminUserId:target.adminUserId,role:'workspace_admin',accessMode:'read_only',tenantId:f.tenant.tenantId,workspaceId:f.one.workspaceId,
   groupKey:null,monitorProfiles:[],monitorBookletVisibility:'visible',createdAt:f.now()};await f.repository.saveAdminRoleAssignment(role);
  await set('on');assert.equal(Object.hasOwn((await f.services.originalAdminSession.read({token:targetSession.token})).claims,'superAdmin'),true);
  const before=(await f.repository.listAdminRoleAssignmentsByUserId(target.adminUserId)).filter(r=>r.role==='platform_admin');assert.equal(before.length,1);
  await set('on');assert.deepEqual((await f.repository.listAdminRoleAssignmentsByUserId(target.adminUserId)).filter(r=>r.role==='platform_admin'),before,'Repeated on is idempotent.');
  await set('ON');assert.equal(Object.hasOwn((await f.services.originalAdminSession.read({token:targetSession.token})).claims,'superAdmin'),false,'Source accepts ON but its actual comparison disables Root.');
  assert.deepEqual(await f.repository.listAdminRoleAssignmentsByUserId(target.adminUserId),[role]);
  await f.reopen();assert.deepEqual(await f.repository.listAdminRoleAssignmentsByUserId(target.adminUserId),[role]);
 });
 await t.test('self-revocation stays forbidden even when the Source alias would silently disable it',async()=>{
  for(const state of ['off','true','ON','0'])await assert.rejects(set(state,{p:f.password},'1'),error=>error.statusCode===409&&error.errorCode==='admin_self_revoke_platform_role_forbidden');
  await set('on',{p:f.password},'1');assert.equal(Object.hasOwn((await f.services.originalAdminSession.read({token:f.root.token})).claims,'superAdmin'),true);
 });
 await t.test('a failed audit leaves Root grants unchanged',async()=>{
  await set('off');const before=await f.allRoles(),audits=await f.repository.listAdminAuditEvents(),collision=audits[0].adminAuditEventId;
  const repository={...f.repository,mutateOriginalAdminSession:(selector,transform)=>f.repository.mutateOriginalAdminSession(selector,s=>{
   const effect=transform(s);if(effect.rootRoleChange)effect.audit.adminAuditEventId=collision;return effect;
  })};
  const services=createFirstSliceServices({repository,now:f.now});
  await assert.rejects(services.originalAdminDirectory.setSuperadmin({token:f.root.token,reference:'4',status:'on',body:{p:f.password}}));
  assert.deepEqual(await f.allRoles(),before);assert.deepEqual(await f.repository.listAdminAuditEvents(),audits);
 });
 await t.test('Root status writes do not decode target custom text or unrelated role payloads',async()=>{
  const marker='OWNED_LIFECYCLE_PRIVATE_'+randomUUID(),user=await f.repository.getAdminUserById(target.adminUserId);await f.repository.saveAdminUser({...user,customTexts:{privateFixtureMarker:marker}});
  const original=JSON.parse,parser=pgTypes.getTypeParser(3802);JSON.parse=text=>{if(typeof text==='string'&&text.includes(marker))throw Error('Unrelated lifecycle decoder fence');return original(text);};
  if(kind==='postgres')pgTypes.setTypeParser(3802,JSON.parse);
  try{await set('on');await set('off');}finally{JSON.parse=original;if(kind==='postgres')pgTypes.setTypeParser(3802,parser);}
 });
 await verifyNativeAdminLifecycleSecurity(t,f,target);
 await t.test('exact high native user IDs keep their identity for Root changes',async()=>{
  await f.repository.mutateOriginalAdminSession({token:f.root.token,at:f.now()},()=>({counter:'9007199254740992'}));
  const id=await f.services.originalAdminDirectory.createUser({token:f.root.token,name:'Owned exact Root target',password:f.password});assert.equal(id,'9007199254740993');
  await set('on',{p:f.password},id);assert.match(await f.services.originalAdminDirectory.listUsers({token:f.root.token}),/"id":9007199254740993,"email":null,"isSuperadmin":true/);
  await set('off',{p:f.password},id);
 });
});

test(`real ${process.env.FIRST_SLICE_STORE==='postgres'?'PostgreSQL':'SQLite'} native administrator lifecycle HTTP matches measured status responses`,{timeout:180000},async t=>{
 const f=await fixture(process.env.FIRST_SLICE_STORE==='postgres'?'postgres':'sqlite',t);await prepare(f);const previous=new Map();
 const env={FIRST_SLICE_STORE:f.kind,FIRST_SLICE_SQLITE_FILE:f.file,...f.url?{FIRST_SLICE_POSTGRES_URL:f.url.toString()}:{},FIRST_SLICE_BOOTSTRAP_DEMO:'false',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_PROOF_OF_WORK_SCOPES:''};
 for(const[key,value]of Object.entries(env)){previous.set(key,process.env[key]);process.env[key]=value;}
 let server;try{server=await createProductionApiServer();}finally{for(const[key,value]of previous)if(value===undefined)delete process.env[key];else process.env[key]=value;}
 await new Promise(done=>server.listen(0,'127.0.0.1',done));f.beforeShutdown(async()=>{server.closeAllConnections();await new Promise(done=>server.close(done));});
 const base='http://127.0.0.1:'+server.address().port;
 const request=async(method,path,body,raw,token=f.root.token)=>{
  const payload=raw??(body===undefined?undefined:JSON.stringify(body));const r=await fetch(base+path,{method,headers:{...(token===null?{}:{AuthToken:token}),...(payload===undefined?{}:{'content-type':'application/json'})},
   ...(payload===undefined?{}:{body:payload}),signal:AbortSignal.timeout(15000)});return{status:r.status,text:await r.text(),headers:r.headers};
 };
 const path='/user/4/super-admin/on',reader=await f.services.originalAdminSession.login({name:readerName,password:f.password});
 assert.equal((await request('PATCH',path,undefined,'{',null)).status,401);assert.equal((await request('PATCH',path,undefined,'{',reader.token)).status,403);
 assert.equal((await request('PATCH',path,undefined,'{')).status,500);
 await replay(f,request);
 assert.equal((await request('PATCH','/user/1/super-admin/off',{p:f.password})).status,409);
});
