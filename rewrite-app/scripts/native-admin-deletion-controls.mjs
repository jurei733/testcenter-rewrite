import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {types as pgTypes} from 'pg';
import {createFirstSliceServices,decodeOriginalTestLogJson} from '@testcenter-rewrite-app/application';
import {createProductionApiServer} from '../apps/api/dist/apps/api/src/index.js';
import {fixture} from './native-admin-permissions-controls.mjs';
import {verifyNativeAdminDeletionSecurity} from './native-admin-deletion-security-controls.mjs';

const root=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-administration-deletion-http/',import.meta.url);
const bytes=await readFile(new URL('observations.json',root)),source=JSON.parse(bytes),proof=JSON.parse(await readFile(new URL('independent-verification.json',root))),manifest=JSON.parse(await readFile(new URL('manifest.json',root)));
const hash=data=>createHash('sha256').update(data).digest('hex');
assert.equal(hash(bytes),proof.observationSha256);assert.equal(source.verified,true);assert.equal(source.actualHttpExchanges,210);assert.equal(source.baselineRestored,true);
assert.equal(source.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');assert.equal(Object.keys(source.sourceHashes).length,137);assert.deepEqual(source.sourceRuntimeBefore,source.sourceRuntimeAfter);
for(const[name,digest]of Object.entries(manifest.files))assert.equal(hash(await readFile(new URL(name,root))),digest);
assert.equal(hash(await readFile(new URL('verify.mjs',root))),proof.verifierSha256);
const kinds=['memory','file','sqlite',...(process.env.FIRST_SLICE_STORE==='postgres'?['postgres']:[])];
const status=code=>e=>e.statusCode===code;
async function replay(f,request){
 const ids=new Map([['1','1'],['2','2'],['3','3']]);let current=null,cases=0;
 for(const row of source.rows){
  if(row.label==='baseline-users'){
   assert.deepEqual(JSON.parse((await request('GET','/users')).text),row.value);continue;
  }
  if(row.label.startsWith('create-users-')){
   current=row.rawText;const actual=await request('PUT','/user',{...row.requestBody,p:f.password});assert.equal(actual.status,201,row.label);ids.set(current,actual.text);cases++;continue;
  }
  if(!row.label.startsWith('users-')||row.label.startsWith('users-auth-')||row.label==='users-after-partial'||row.label.startsWith('users-method-'))continue;
  let body=row.requestBody===undefined?undefined:structuredClone(row.requestBody),raw=row.rawRequestBody;
  if(body&&typeof body==='object'&&!Array.isArray(body)){
   if(body.p==='[owned-root-password]')body.p=f.password;
   if(Array.isArray(body.u))body.u=body.u.map(value=>typeof value==='number'&&String(value)===current?Number(ids.get(current)):
    typeof value==='string'&&current&&value.includes(current)?value.replace(current,ids.get(current)):value);
  }
  if(raw){raw=raw.replaceAll('[owned-root-password]',f.password);if(/users-element-(whole-float|fraction)$/.test(row.label))raw=raw.replace('['+current,'['+ids.get(current));}
  const actual=await request(row.method,row.path,body,raw);assert.equal(actual.status,row.status,row.label+': '+actual.text);cases++;
  if(row.method==='GET')assert.deepEqual(JSON.parse(actual.text),row.value.map(user=>({...user,id:Number(ids.get(String(user.id)))})),row.label);
  else assert.equal(actual.text,row.rawText,row.label);
  if(actual.headers){assert.equal(actual.headers.get('content-type'),row.contentType,row.label);assert.equal(actual.headers.get('cache-control'),'private, no-store');}
 }
 assert.ok(cases>80);
 // Original commits the first row before a later invalid ID. The Rewrite's
 // required atomic gate retains it; do not normalize this into false parity.
 const partial=source.rows.find(r=>r.label==='create-users-partial');
 assert.ok(JSON.parse((await request('GET','/users')).text).some(user=>String(user.id)===ids.get(partial.rawText)));
 assert.equal(source.rows.find(r=>r.label==='users-after-partial').value.some(user=>String(user.id)===partial.rawText),false);
 const cleanup=await request('DELETE','/users',{u:[...ids.values()].slice(3),p:f.password});assert.equal(cleanup.status,200);
 assert.deepEqual(JSON.parse((await request('GET','/users')).text),source.rows.find(r=>r.label==='final-users').value);
 return cases;
}
for(const kind of kinds)test(`${kind}: native user deletion matches Source parameters and atomic identity cleanup`,{timeout:180000},async t=>{
 const f=await fixture(kind,t),remove=(ids,services=f.services)=>services.originalAdminDirectory.deleteUsers({token:f.root.token,body:{u:ids,p:f.password}});
 await t.test('actual Source sequence and deliberate rollback of Source partial failure',async()=>{
  await replay(f,async(method,path,body,raw)=>{
   try{
    if(method==='GET')return{status:200,text:await f.services.originalAdminDirectory.listUsers({token:f.root.token})};
    let parsed;try{parsed=decodeOriginalTestLogJson(raw??JSON.stringify(body));}catch{return{status:500,text:'Internal error.'};}
    if(method==='PUT')return{status:201,text:await f.services.originalAdminDirectory.createUser({token:f.root.token,name:body.n,password:body.p})};
    await f.services.originalAdminDirectory.deleteUsers({token:f.root.token,body:parsed});return{status:200,text:''};
   }catch(error){return{status:error.statusCode,text:error.message};}
  });
 });
 await t.test('deletion removes only target credentials, all owned roles/sessions and native identity',async()=>{
  const name='Owned user cleanup '+kind,id=await f.services.originalAdminDirectory.createUser({token:f.root.token,name,password:f.password});
  const user=await f.repository.getAdminUserByUsername(name),one=await f.services.originalAdminSession.login({name,password:f.password}),two=await f.services.originalAdminSession.login({name,password:f.password});
  await f.repository.saveAdminRoleAssignment({roleAssignmentId:randomUUID(),adminUserId:user.adminUserId,role:'platform_admin',accessMode:'read_write',tenantId:null,workspaceId:null,groupKey:null,monitorProfiles:[],monitorBookletVisibility:'visible',createdAt:f.now()});
  await f.repository.saveAdminRoleAssignment({roleAssignmentId:randomUUID(),adminUserId:user.adminUserId,role:'workspace_admin',accessMode:'read_only',tenantId:f.tenant.tenantId,workspaceId:f.one.workspaceId,groupKey:null,monitorProfiles:[],monitorBookletVisibility:'visible',createdAt:f.now()});
  const foreign=(await f.allRoles()).filter(r=>r.adminUserId!==user.adminUserId),rootSession=await f.repository.getAdminSessionByToken(f.root.token);
  await remove([id,id]);assert.equal(await f.repository.getAdminUserById(user.adminUserId),null);assert.equal(await f.repository.getAdminUserByUsername(name),null);
  assert.deepEqual(await f.repository.listAdminRoleAssignmentsByUserId(user.adminUserId),[]);
  for(const token of [one.token,two.token]){assert.equal(await f.repository.getAdminSessionByToken(token),null);await assert.rejects(f.services.originalAdminSession.read({token}),status(403));}
  assert.deepEqual(await f.allRoles(),foreign);assert.deepEqual(await f.repository.getAdminSessionByToken(f.root.token),rootSession);
  const events=(await f.repository.listAdminAuditEvents()).filter(a=>a.eventType==='admin_user_deleted'&&a.subjectAdminUserId===user.adminUserId);assert.equal(events.length,1);
  await f.reopen();assert.equal(await f.repository.getAdminUserByUsername(name),null);
  const replacement=await f.services.originalAdminDirectory.createUser({token:f.root.token,name,password:f.password});assert.ok(BigInt(replacement)>BigInt(id));
  assert.notEqual((await f.repository.getAdminUserByUsername(name)).adminUserId,user.adminUserId);await remove([replacement]);
 });
 await t.test('self in a mixed list denies the whole batch and Root remains valid',async()=>{
  const users=await f.repository.listAdminUsers(),roles=await f.allRoles(),audits=await f.repository.listAdminAuditEvents();
  for(const ids of [['2','1'],['2',true],['1','1']]){
   await assert.rejects(remove(ids),e=>e.statusCode===409&&e.errorCode==='admin_self_delete_forbidden');
   assert.deepEqual(await f.repository.listAdminUsers(),users);assert.deepEqual(await f.allRoles(),roles);assert.deepEqual(await f.repository.listAdminAuditEvents(),audits);
  }
  assert.ok(Object.hasOwn((await f.services.originalAdminSession.read({token:f.root.token})).claims,'superAdmin'));
 });
 await t.test('late audit failure restores the entire batch, sessions and numeric identities',async()=>{
  const token=(await f.services.originalAdminSession.login({name:f.a.username,password:f.password})).token;
  const users=await f.repository.listAdminUsers(),roles=await f.allRoles(),session=await f.repository.getAdminSessionByToken(token),directory=await f.services.originalAdminDirectory.listUsers({token:f.root.token}),audits=await f.repository.listAdminAuditEvents();
  const repository={...f.repository,mutateOriginalAdminSession:(selector,transform)=>f.repository.mutateOriginalAdminSession(selector,s=>{const e=transform(s);if(e.deletedUsers)e.audits[1].adminAuditEventId=audits[0].adminAuditEventId;return e;})};
  await assert.rejects(remove(['2','3'],createFirstSliceServices({repository,now:f.now})));
  assert.deepEqual(await f.repository.listAdminUsers(),users);assert.deepEqual(await f.allRoles(),roles);assert.deepEqual(await f.repository.getAdminSessionByToken(token),session);
  assert.equal(await f.services.originalAdminDirectory.listUsers({token:f.root.token}),directory);assert.deepEqual(await f.repository.listAdminAuditEvents(),audits);
 });
 await t.test('current storage metadata rejects forged Root and a substituted target',async()=>{
  let metadata;await f.repository.mutateOriginalAdminSession({token:f.root.token,at:f.now(),directory:'users',adminWrite:'delete-users'},s=>{metadata=structuredClone(s);return{};});
  const peer=await f.services.originalAdminSession.login({name:f.a.username,password:f.password}),before=await f.repository.listAdminUsers(),audits=await f.repository.listAdminAuditEvents();
  const forged={...f.repository,mutateOriginalAdminSession:(selector,transform)=>f.repository.mutateOriginalAdminSession(selector,s=>{s.roles=[{...metadata.roles[0],adminUserId:s.user.adminUserId}];s.directory=structuredClone(metadata.directory);return transform(s);})};
  await assert.rejects(createFirstSliceServices({repository:forged,now:f.now}).originalAdminDirectory.deleteUsers({token:peer.token,body:{u:['3'],p:f.password}}),/deletion authorization changed/);
  const substituted={...f.repository,mutateOriginalAdminSession:(selector,transform)=>f.repository.mutateOriginalAdminSession(selector,s=>{const e=transform(s);if(e.deletedUsers)e.deletedUsers[0].adminUserId=metadata.user.adminUserId;return e;})};
  await assert.rejects(remove(['2'],createFirstSliceServices({repository:substituted,now:f.now})),/deletion target changed/);
  assert.deepEqual(await f.repository.listAdminUsers(),before);assert.deepEqual(await f.repository.listAdminAuditEvents(),audits);
 });
 await t.test('native deletion does not decode target custom text, role profiles or unrelated packages',async()=>{
  const marker='OWNED_DELETE_PRIVATE_'+randomUUID(),name='Owned private user deletion '+kind;
  const id=await f.services.originalAdminDirectory.createUser({token:f.root.token,name,password:f.password});
  const user=await f.repository.getAdminUserByUsername(name);await f.repository.saveAdminUser({...user,customTexts:{privateFixtureMarker:marker}});
  await f.repository.saveAdminRoleAssignment({roleAssignmentId:randomUUID(),adminUserId:user.adminUserId,role:'group_monitor',accessMode:'read_only',tenantId:f.tenant.tenantId,workspaceId:f.one.workspaceId,groupKey:'OWNED',monitorProfiles:[marker],monitorBookletVisibility:'visible',createdAt:f.now()});
  const sourcePackageId=randomUUID();await f.repository.saveSourcePackage({sourcePackageId,tenantId:f.tenant.tenantId,workspaceId:f.one.workspaceId,fileName:'owned.xml',mediaType:'application/xml',sourceDocument:marker,contentStructure:{bookletEntries:[],privateFixtureMarker:marker},status:'accepted',uploadedAt:f.now()});
  const original=JSON.parse,parser=pgTypes.getTypeParser(3802);JSON.parse=text=>{if(typeof text==='string'&&text.includes(marker))throw Error('Private deletion decoder fence');return original(text);};
  if(kind==='postgres')pgTypes.setTypeParser(3802,JSON.parse);
  try{await remove([id]);}finally{JSON.parse=original;if(kind==='postgres')pgTypes.setTypeParser(3802,parser);}
  assert.equal(await f.repository.getAdminUserById(user.adminUserId),null);assert.equal((await f.repository.getSourcePackageById(sourcePackageId)).sourceDocument,marker);
 });
 await verifyNativeAdminDeletionSecurity(t,f);
 await t.test('exact int64 target stays exact and cannot recover its former identity',async()=>{
  await f.repository.mutateOriginalAdminSession({token:f.root.token,at:f.now()},()=>({counter:'9007199254740992'}));
  const id=await f.services.originalAdminDirectory.createUser({token:f.root.token,name:'Owned high deletion',password:f.password});assert.equal(id,'9007199254740993');
  await f.services.originalAdminDirectory.deleteUsers({token:f.root.token,body:decodeOriginalTestLogJson('{"u":[9007199254740993],"p":'+JSON.stringify(f.password)+'}')});
  assert.equal(await f.repository.getAdminUserByUsername('Owned high deletion'),null);assert.doesNotMatch(await f.services.originalAdminDirectory.listUsers({token:f.root.token}),/9007199254740993/);
 });
});

test(`real ${process.env.FIRST_SLICE_STORE==='postgres'?'PostgreSQL':'SQLite'} native user deletion HTTP keeps measured responses`,{timeout:180000},async t=>{
 const f=await fixture(process.env.FIRST_SLICE_STORE==='postgres'?'postgres':'sqlite',t),previous=new Map();
 const env={FIRST_SLICE_STORE:f.kind,FIRST_SLICE_SQLITE_FILE:f.file,...f.url?{FIRST_SLICE_POSTGRES_URL:f.url.toString()}:{},FIRST_SLICE_BOOTSTRAP_DEMO:'false',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_PROOF_OF_WORK_SCOPES:''};
 for(const[key,value]of Object.entries(env)){previous.set(key,process.env[key]);process.env[key]=value;}
 let server;try{server=await createProductionApiServer();}finally{for(const[key,value]of previous)if(value===undefined)delete process.env[key];else process.env[key]=value;}
 await new Promise(done=>server.listen(0,'127.0.0.1',done));f.beforeShutdown(async()=>{server.closeAllConnections();await new Promise(done=>server.close(done));});
 const request=async(method,path,body,raw,token=f.root.token)=>{
  const payload=raw??(body===undefined?undefined:JSON.stringify(body));const r=await fetch('http://127.0.0.1:'+server.address().port+path,{method,headers:{...(token===null?{}:{AuthToken:token}),...(payload===undefined?{}:{'content-type':'application/json'})},...(payload===undefined?{}:{body:payload}),signal:AbortSignal.timeout(15000)});
  return{status:r.status,text:await r.text(),headers:r.headers};
 };
 const reader=await f.services.originalAdminSession.login({name:f.a.username,password:f.password});
 for(const[token,expected]of [[null,401],[reader.token,403],[f.root.token,500]])assert.equal((await request('DELETE','/users',undefined,'{',token)).status,expected);
 await replay(f,request);assert.equal((await request('DELETE','/users',{u:['1'],p:f.password})).status,409);
});
